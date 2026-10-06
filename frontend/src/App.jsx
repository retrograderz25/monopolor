import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import './App.css';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3001';
const socket = io(SOCKET_URL, {
  transports: ['websocket', 'polling'],
});

const DICE_FACES = ['', '⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];

const PLAYER_COLORS = [
  '#ef4444',
  '#3b82f6',
  '#10b981',
  '#a855f7',
  '#f59e0b',
  '#06b6d4',
];

const GROUP_COLORS = {
  brown: '#8b4513',
  lightblue: '#87ceeb',
  pink: '#ff69b4',
  orange: '#ffa500',
  red: '#ef4444',
  yellow: '#ffd700',
  green: '#16a34a',
  darkblue: '#1d4ed8',
  railroad: '#475569',
  utility: '#64748b',
};

const CELL_ICONS = {
  GO: '🏁',
  CHEST: '🃏',
  TAX: '💸',
  RAILROAD: '🚆',
  UTILITY: '⚡',
  CHANCE: '❔',
  JAIL: '🔒',
  FREE_PARKING: '🅿️',
  GO_TO_JAIL: '🚓',
};

const formatMoney = (value = 0) =>
  `$${Number(value || 0).toLocaleString('en-US')}`;

const getGridPosition = (id) => {
  if (id === 0) return { gridRow: 11, gridColumn: 11 };
  if (id > 0 && id < 10) return { gridRow: 11, gridColumn: 11 - id };
  if (id === 10) return { gridRow: 11, gridColumn: 1 };
  if (id > 10 && id < 20) return { gridRow: 21 - id, gridColumn: 1 };
  if (id === 20) return { gridRow: 1, gridColumn: 1 };
  if (id > 20 && id < 30) return { gridRow: 1, gridColumn: id - 19 };
  if (id === 30) return { gridRow: 1, gridColumn: 11 };
  if (id > 30 && id < 40) return { gridRow: id - 29, gridColumn: 11 };
  return { gridRow: 1, gridColumn: 1 };
};

const getLocalPlayerId = () => {
  let pid = localStorage.getItem('monopoly_playerId');

  if (!pid) {
    pid = Math.random().toString(36).substring(2, 10);
    localStorage.setItem('monopoly_playerId', pid);
  }

  return pid;
};

const createEmptyTrade = () => ({
  visible: false,
  targetId: '',
  offerM: 0,
  reqM: 0,
  offerCells: [],
  reqCells: [],
});

export default function App() {
  const playerId = useMemo(() => getLocalPlayerId(), []);

  const [gameState, setGameState] = useState(null);
  const [roomId, setRoomId] = useState('ROOM_1');
  const [playerName, setPlayerName] = useState('');

  const [logs, setLogs] = useState([]);
  const [latestCard, setLatestCard] = useState({
    text: 'Chưa có sự kiện mới',
    owner: '',
  });

  const [diceDisplay, setDiceDisplay] = useState({
    d1: 6,
    d2: 6,
  });

  const [isRolling, setIsRolling] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState(
    socket.connected ? 'connected' : 'connecting'
  );

  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('monopoly_theme') || 'dark';
  });

  const [toast, setToast] = useState(null);
  const toastTimerRef = useRef(null);

  const [tradeModal, setTradeModal] = useState(createEmptyTrade);

  const [displayPositions, setDisplayPositions] = useState({});
  const displayPositionsRef = useRef({});
  const animationTimersRef = useRef({});
  const rollInterval = useRef(null);
  const logEndRef = useRef(null);
  const roomIdRef = useRef(roomId);

  useEffect(() => {
    roomIdRef.current = roomId;
  }, [roomId]);

  useEffect(() => {
    localStorage.setItem('monopoly_theme', theme);
  }, [theme]);

  const showToast = useCallback((type, message, duration = 3200) => {
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
    }

    setToast({ type, message });

    toastTimerRef.current = setTimeout(() => {
      setToast(null);
    }, duration);
  }, []);

  const updateDisplayPosition = useCallback((targetPlayerId, position) => {
    displayPositionsRef.current[targetPlayerId] = position;

    setDisplayPositions((prev) => ({
      ...prev,
      [targetPlayerId]: position,
    }));
  }, []);

  const animateTokenStepByStep = useCallback(
    (targetPlayerId, startPosition, targetPosition) => {
      const start = Number(startPosition);
      const target = Number(targetPosition);

      if (animationTimersRef.current[targetPlayerId]) {
        clearInterval(animationTimersRef.current[targetPlayerId]);
        delete animationTimersRef.current[targetPlayerId];
      }

      if (start === target) {
        updateDisplayPosition(targetPlayerId, target);
        return;
      }

      const forwardSteps = (target - start + 40) % 40;
      const backwardSteps = (start - target + 40) % 40;

      // Dice movement is always forward. The only normal backward movement
      // currently implemented by the backend is the Chance card "lùi 3 bước".
      const isThreeStepBack =
        backwardSteps === 3 && target === (start - 3 + 40) % 40;

      const direction = isThreeStepBack ? -1 : 1;
      const totalSteps = isThreeStepBack ? backwardSteps : forwardSteps;

      let current = start;
      let stepCount = 0;

      animationTimersRef.current[targetPlayerId] = setInterval(() => {
        current = (current + direction + 40) % 40;

        updateDisplayPosition(targetPlayerId, current);

        stepCount += 1;

        if (stepCount >= totalSteps) {
          clearInterval(animationTimersRef.current[targetPlayerId]);
          delete animationTimersRef.current[targetPlayerId];

          updateDisplayPosition(targetPlayerId, target);
        }
      }, 150);
    },
    [updateDisplayPosition]
  );

  useEffect(() => {
    const handleConnect = () => {
      setConnectionStatus('connected');
      showToast('success', 'Đã kết nối máy chủ realtime.', 2200);
    };

    const handleDisconnect = () => {
      setConnectionStatus('disconnected');
      showToast('error', 'Mất kết nối máy chủ. Đang chờ kết nối lại...', 5000);
    };

    const handleUpdateState = (newState) => {
      if (!newState?.players) {
        setGameState(newState);
        return;
      }

      newState.players.forEach((player) => {
        const currentVisualPosition =
          displayPositionsRef.current[player.playerId];

        if (currentVisualPosition === undefined) {
          updateDisplayPosition(player.playerId, player.position);
          return;
        }

        if (currentVisualPosition !== player.position) {
          animateTokenStepByStep(
            player.playerId,
            currentVisualPosition,
            player.position
          );
        }
      });

      setGameState(newState);
    };

    const handleMessage = (msg) => {
      setLogs((prev) => [...prev, msg].slice(-50));

      if (msg.includes('🃏 Bốc thẻ:')) {
        const text = msg
          .split('🃏 Bốc thẻ:')
          .slice(1)
          .join('🃏 Bốc thẻ:')
          .trim();

        setLatestCard({
          text,
          owner: '',
        });
      }
    };

    const handleDiceResult = ({ d1, d2, playerName: rollerName }) => {
      if (rollInterval.current) {
        clearInterval(rollInterval.current);
        rollInterval.current = null;
      }

      setIsRolling(false);
      setDiceDisplay({ d1, d2 });

      setLatestCard((prev) => ({
        ...prev,
        owner: rollerName,
      }));
    };

    const handleError = (message) => {
      showToast('error', message || 'Đã xảy ra lỗi.', 4200);
    };

    const handleForceEndTurn = () => {
      socket.emit('END_TURN', roomIdRef.current);
    };

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('UPDATE_STATE', handleUpdateState);
    socket.on('MESSAGE', handleMessage);
    socket.on('DICE_RESULT', handleDiceResult);
    socket.on('ERROR', handleError);
    socket.on('FORCE_END_TURN', handleForceEndTurn);

    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('UPDATE_STATE', handleUpdateState);
      socket.off('MESSAGE', handleMessage);
      socket.off('DICE_RESULT', handleDiceResult);
      socket.off('ERROR', handleError);
      socket.off('FORCE_END_TURN', handleForceEndTurn);
    };
  }, [animateTokenStepByStep, showToast, updateDisplayPosition]);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({
      behavior: 'smooth',
      block: 'nearest',
    });
  }, [logs]);

  useEffect(() => {
    return () => {
      if (rollInterval.current) {
        clearInterval(rollInterval.current);
      }

      if (toastTimerRef.current) {
        clearTimeout(toastTimerRef.current);
      }

      Object.values(animationTimersRef.current).forEach((timer) => {
        clearInterval(timer);
      });
    };
  }, []);

  const joinRoom = () => {
    const cleanName = playerName.trim();
    const cleanRoomId = roomId.trim() || 'ROOM_1';

    if (!cleanName) {
      showToast('warning', 'Nhập tên người chơi trước nhé.');
      return;
    }

    setRoomId(cleanRoomId);

    socket.emit('JOIN_ROOM', {
      roomId: cleanRoomId,
      playerId,
      playerName: cleanName,
    });
  };

  const handleRollClick = () => {
    if (!gameState) return;

    if (!isRolling) {
      setIsRolling(true);

      rollInterval.current = setInterval(() => {
        setDiceDisplay({
          d1: Math.floor(Math.random() * 6) + 1,
          d2: Math.floor(Math.random() * 6) + 1,
        });
      }, 65);

      return;
    }

    socket.emit('ROLL_DICE', roomIdRef.current);
  };

  const myPlayer = gameState?.players?.find(
    (player) => player.playerId === playerId
  );

  const currentPlayer =
    gameState?.players?.[gameState.currentTurnIndex] || null;

  const isMyTurn = currentPlayer?.playerId === playerId;
  const hasRolled = Boolean(gameState?.hasRolled);
  const pendingAction = gameState?.pendingAction || null;

  const myProperties =
    gameState?.board?.filter((cell) => cell.owner === playerId) || [];

  const activeOtherPlayers =
    gameState?.players?.filter(
      (player) =>
        player.playerId !== playerId &&
        !player.bankrupt &&
        !player.disconnected
    ) || [];

  const getPlayerColor = (targetPlayerId) => {
    const index =
      gameState?.players?.findIndex(
        (player) => player.playerId === targetPlayerId
      ) ?? -1;

    return index >= 0
      ? PLAYER_COLORS[index % PLAYER_COLORS.length]
      : '#64748b';
  };

  const openTradeModal = () => {
    setTradeModal({
      ...createEmptyTrade(),
      visible: true,
    });
  };

  const buildHouse = (cell) => {
    socket.emit('BUILD_HOUSE', {
      roomId: roomIdRef.current,
      cellId: cell.id,
    });

    showToast('info', `Đang yêu cầu xây nhà tại ${cell.name}.`, 2000);
  };

  const sellHouse = (cell) => {
    socket.emit('SELL_HOUSE', {
      roomId: roomIdRef.current,
      cellId: cell.id,
    });

    showToast('info', `Đang yêu cầu bán nhà tại ${cell.name}.`, 2000);
  };

  const mortgage = (cell) => {
    socket.emit('MORTGAGE', {
      roomId: roomIdRef.current,
      cellId: cell.id,
    });

    showToast('info', `Đang cầm cố ${cell.name}.`, 2000);
  };

  const unmortgage = (cell) => {
    socket.emit('UNMORTGAGE', {
      roomId: roomIdRef.current,
      cellId: cell.id,
    });

    showToast('info', `Đang chuộc lại ${cell.name}.`, 2000);
  };

  const renderPropertyCard = (cell, compact = false) => {
    const groupColor = GROUP_COLORS[cell.group] || '#475569';

    return (
      <div
        key={cell.id}
        className={`property-card ${compact ? 'property-card-compact' : ''}`}
        style={{ opacity: cell.isMortgaged ? 0.62 : 1 }}
      >
        <div
          className="property-card-color"
          style={{ background: groupColor }}
        />

        <div className="property-card-main">
          <div className="property-card-title-row">
            <strong>{cell.name}</strong>

            {cell.type === 'RAILROAD' && (
              <span className="property-type-badge">GA</span>
            )}

            {cell.type === 'UTILITY' && (
              <span className="property-type-badge">DV</span>
            )}
          </div>

          <div className="property-card-meta">
            {cell.type === 'PROPERTY'
              ? `${cell.houses || 0}/5 nhà • ${formatMoney(
                  cell.housePrice
                )} / nhà`
              : `${formatMoney(cell.price)}`}
          </div>

          {cell.isMortgaged && (
            <div className="mortgage-status">ĐANG CẦM CỐ</div>
          )}
        </div>

        <div className="property-actions">
          {!cell.isMortgaged &&
            cell.type === 'PROPERTY' &&
            cell.houses < 5 && (
              <button
                type="button"
                className="mini-action mini-action-build"
                onClick={() => buildHouse(cell)}
              >
                + Xây
              </button>
            )}

          {!cell.isMortgaged &&
            cell.type === 'PROPERTY' &&
            cell.houses > 0 && (
              <button
                type="button"
                className="mini-action mini-action-sell"
                onClick={() => sellHouse(cell)}
              >
                − Bán
              </button>
            )}

          {!cell.isMortgaged && cell.houses === 0 && (
            <button
              type="button"
              className="mini-action mini-action-mortgage"
              onClick={() => mortgage(cell)}
            >
              Cầm
            </button>
          )}

          {cell.isMortgaged && (
            <button
              type="button"
              className="mini-action mini-action-unmortgage"
              onClick={() => unmortgage(cell)}
            >
              Chuộc
            </button>
          )}
        </div>
      </div>
    );
  };

  const renderTradeProperties = (cellIds = []) => {
    return cellIds.map((cellId) => {
      const cell = gameState?.board?.find((item) => item.id === cellId);

      return cell ? (
        <span className="trade-chip" key={cell.id}>
          {cell.name}
        </span>
      ) : null;
    });
  };

  if (!gameState) {
    return (
      <div className={`app-container theme-${theme} app-login`}>
        <div className="login-shell">
          <div className="login-glow" />

          <div className="login-card">
            <div className="login-top-row">
              <div className="brand-mark">M</div>

              <button
                type="button"
                className="theme-toggle login-theme-toggle"
                onClick={() =>
                  setTheme((current) =>
                    current === 'dark' ? 'light' : 'dark'
                  )
                }
                aria-label="Đổi giao diện sáng tối"
              >
                {theme === 'dark' ? '☀️' : '🌙'}
              </button>
            </div>

            <div className="login-heading">
              <span className="eyebrow">STUDIO EDITION</span>
              <h1>MONOPOLY VIỆT NAM</h1>
              <p>
                Bàn cờ realtime, xúc xắc mượt và giao diện tối ưu cho mọi màn
                hình.
              </p>
            </div>

            <div className="login-form">
              <label>
                Tên người chơi
                <input
                  value={playerName}
                  onChange={(event) => setPlayerName(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') joinRoom();
                  }}
                  placeholder="Ví dụ: Phương"
                  autoComplete="nickname"
                />
              </label>

              <label>
                Mã phòng
                <input
                  value={roomId}
                  onChange={(event) => setRoomId(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') joinRoom();
                  }}
                  placeholder="ROOM_1"
                  autoComplete="off"
                />
              </label>

              <button
                type="button"
                className="primary-button login-button"
                onClick={joinRoom}
              >
                VÀO PHÒNG
              </button>
            </div>

            <div className="connection-note">
              <span className={`connection-dot ${connectionStatus}`} />
              {connectionStatus === 'connected'
                ? 'Máy chủ realtime đã kết nối'
                : connectionStatus === 'connecting'
                ? 'Đang kết nối máy chủ...'
                : 'Mất kết nối máy chủ'}
            </div>
          </div>
        </div>

        {toast && (
          <div className={`toast toast-${toast.type}`} role="status">
            <span className="toast-icon">
              {toast.type === 'success'
                ? '✓'
                : toast.type === 'error'
                ? '!'
                : toast.type === 'warning'
                ? '⚠'
                : 'i'}
            </span>
            <span>{toast.message}</span>
            <button
              type="button"
              className="toast-close"
              onClick={() => setToast(null)}
              aria-label="Đóng thông báo"
            >
              ×
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={`app-container theme-${theme}`}>
      <div className="top-status-bar">
        <div className="top-status-left">
          <span className="room-pill">ROOM: {roomId}</span>

          <span className={`online-pill ${connectionStatus}`}>
            <span className="connection-dot" />
            {connectionStatus === 'connected'
              ? 'ONLINE'
              : connectionStatus === 'connecting'
              ? 'CONNECTING'
              : 'OFFLINE'}
          </span>
        </div>

        <div className="top-status-right">
          <span className="player-name-pill">
            🎮 {myPlayer?.name || playerName}
          </span>

          {myPlayer?.inJail && (
            <span className="jail-pill">🔒 ĐANG Ở TÙ</span>
          )}

          <button
            type="button"
            className="theme-toggle"
            onClick={() =>
              setTheme((current) =>
                current === 'dark' ? 'light' : 'dark'
              )
            }
            aria-label="Đổi giao diện sáng tối"
          >
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>
        </div>
      </div>

      <main className="game-stage">
        <section className="mobile-player-strip" aria-label="Tài sản người chơi">
          <div className="mobile-player-strip-scroll">
            {gameState.players.map((player, index) => {
              const isCurrent =
                player.playerId === currentPlayer?.playerId;
              const isMe = player.playerId === playerId;

              return (
                <div
                  key={player.playerId}
                  className={`mobile-player-pill ${
                    isCurrent ? 'is-current' : ''
                  } ${isMe ? 'is-me' : ''} ${
                    player.bankrupt ? 'is-bankrupt' : ''
                  } ${player.disconnected ? 'is-disconnected' : ''}`}
                >
                  <span
                    className="mobile-player-pill-dot"
                    style={{
                      background:
                        PLAYER_COLORS[
                          index % PLAYER_COLORS.length
                        ],
                    }}
                  />

                  <span className="mobile-player-pill-name">
                    {player.name}
                  </span>

                  <span className="mobile-player-pill-money">
                    {formatMoney(player.money)}
                  </span>
                </div>
              );
            })}
          </div>
        </section>

        <section className="board-section">
          <div className="board-wrap">
            <div className="board">
              {gameState.board.map((cell) => {
                const pos = getGridPosition(cell.id);
                const isCorner = cell.id % 10 === 0;

                const ownerColor = cell.owner
                  ? getPlayerColor(cell.owner)
                  : 'transparent';

                const icon = CELL_ICONS[cell.type];

                return (
                  <div
                    key={cell.id}
                    className={`board-cell ${
                      isCorner ? 'corner-cell' : ''
                    } ${cell.isMortgaged ? 'is-mortgaged' : ''}`}
                    style={pos}
                  >
                    {cell.group && (
                      <div
                        className="cell-color-bar"
                        style={{
                          backgroundColor:
                            GROUP_COLORS[cell.group] || '#64748b',
                        }}
                      >
                        {cell.houses > 0 && (
                          <div className="houses-wrapper">
                            {cell.houses === 5 ? (
                              <span className="hotel-icon">H</span>
                            ) : (
                              Array.from({ length: cell.houses }).map(
                                (_, index) => (
                                  <span
                                    key={index}
                                    className="house-icon"
                                  />
                                )
                              )
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {!cell.group && icon && (
                      <div className="special-cell-icon">{icon}</div>
                    )}

                    <div className="cell-name">{cell.name}</div>

                    {cell.price && (
                      <div className="cell-price">
                        {formatMoney(cell.price)}
                      </div>
                    )}

                    {cell.owner && (
                      <div
                        className="owner-bar"
                        style={{ background: ownerColor }}
                      />
                    )}

                    <div className="tokens-container">
                      {gameState.players
                        .filter((player) => !player.bankrupt)
                        .map((player) => {
                          const currentPosition =
                            displayPositions[player.playerId] ??
                            player.position;

                          if (currentPosition !== cell.id) {
                            return null;
                          }

                          const playerIndex =
                            gameState.players.indexOf(player);

                          return (
                            <div
                              key={player.playerId}
                              className={`player-token ${
                                player.playerId === playerId
                                  ? 'is-self'
                                  : ''
                              }`}
                              style={{
                                background:
                                  PLAYER_COLORS[
                                    playerIndex % PLAYER_COLORS.length
                                  ],
                              }}
                              title={player.name}
                              aria-label={player.name}
                            >
                              {player.playerId === playerId ? '●' : ''}
                            </div>
                          );
                        })}
                    </div>
                  </div>
                );
              })}

              <div
                className={`board-center ${
                  gameState.status === 'WAITING' ? 'is-waiting' : ''
                }`}
              >
                {gameState.status === 'WAITING' ? (
                  <div className="waiting-screen">
                    <div className="waiting-icon">🎲</div>

                    <span className="eyebrow">PHÒNG CHỜ</span>

                    <h2>Chuẩn bị cuộc chơi</h2>

                    <p className="waiting-subtitle">
                      Cần ít nhất 2 người chơi để bắt đầu.
                    </p>

                    <div className="waiting-players">
                      {gameState.players.map((player, index) => (
                        <div
                          className="waiting-player"
                          key={player.playerId}
                        >
                          <span
                            className="waiting-player-dot"
                            style={{
                              background:
                                PLAYER_COLORS[
                                  index % PLAYER_COLORS.length
                                ],
                            }}
                          />

                          <span>{player.name}</span>
                        </div>
                      ))}
                    </div>

                    <button
                      type="button"
                      className="primary-button"
                      onClick={() =>
                        socket.emit('START_GAME', roomIdRef.current)
                      }
                      disabled={gameState.players.length < 2}
                    >
                      {gameState.players.length < 2
                        ? 'ĐỢI NGƯỜI CHƠI...'
                        : '🚀 BẮT ĐẦU GAME'}
                    </button>
                  </div>
                ) : (
                  <div className="hud-shell">
                    <div className="hud-scroll-area">
                      <div className="turn-banner">
                      <div className="turn-banner-main">
                        {isMyTurn
                          ? '🌟 TỚI LƯỢT CỦA BẠN'
                          : `LƯỢT CỦA ${
                              currentPlayer?.name?.toUpperCase() ||
                              'PLAYER'
                            }`}
                      </div>

                      <div className="turn-banner-sub">
                        {currentPlayer
                          ? `${formatMoney(currentPlayer.money)} tiền mặt`
                          : ''}
                      </div>
                    </div>

                      <div className="hud-grid">
                      <aside className="hud-panel hud-properties-panel">
                        <div className="panel-heading">
                          <div>
                            <span className="panel-kicker">PORTFOLIO</span>
                            <h3>Tài sản của bạn</h3>
                          </div>

                          <div className="money-display">
                            <span>💰</span>
                            {formatMoney(myPlayer?.money)}
                          </div>
                        </div>

                        <div className="property-list">
                          {myProperties.length === 0 ? (
                            <div className="empty-properties">
                              <div className="empty-icon">🏙️</div>
                              <strong>Chưa sở hữu đất</strong>
                              <span>
                                Hãy tung xúc xắc và bắt đầu mua tài sản.
                              </span>
                            </div>
                          ) : (
                            myProperties.map((cell) =>
                              renderPropertyCard(cell)
                            )
                          )}
                        </div>
                      </aside>

                      <section className="hud-panel hud-dice-panel">
                        <div className="dice-panel-heading">
                          <span className="panel-kicker">YOUR MOVE</span>

                          <span
                            className={`turn-status ${
                              isMyTurn ? 'my-turn' : ''
                            }`}
                          >
                            {isMyTurn ? 'ĐẾN LƯỢT' : 'ĐANG CHỜ'}
                          </span>
                        </div>

                        <button
                          type="button"
                          className={`dice-display ${
                            isRolling ? 'is-rolling' : ''
                          }`}
                          onClick={
                            isMyTurn && !hasRolled
                              ? handleRollClick
                              : undefined
                          }
                          disabled={!isMyTurn || hasRolled}
                        >
                          <span className="dice-caption">XÚC XẮC</span>

                          <div className="dice-face-row">
                            <span>{DICE_FACES[diceDisplay.d1]}</span>
                            <span>{DICE_FACES[diceDisplay.d2]}</span>
                          </div>

                          <span className="dice-total">
                            {diceDisplay.d1 + diceDisplay.d2}
                          </span>
                        </button>

                        <div className="dice-hint">
                          {isMyTurn
                            ? hasRolled
                              ? 'Bạn đã tung. Hãy xử lý hành động rồi qua lượt.'
                              : isRolling
                              ? 'Bấm lần nữa để chốt kết quả.'
                              : 'Bấm LẮC hoặc chạm trực tiếp vào xúc xắc.'
                            : `Đang chờ ${
                                currentPlayer?.name || 'người chơi'
                              }.`}
                        </div>

                        {myPlayer?.inJail &&
                          isMyTurn &&
                          !hasRolled && (
                            <button
                              type="button"
                              className="secondary-button jail-button"
                              onClick={() =>
                                socket.emit(
                                  'PAY_JAIL_FINE',
                                  roomIdRef.current
                                )
                              }
                              disabled={myPlayer.money < 50}
                            >
                              💸 NỘP $50 ĐỂ RA TÙ
                            </button>
                          )}

                        <div className="hud-actions">
                          {isMyTurn &&
                            !pendingAction &&
                            !myPlayer?.bankrupt && (
                              <>
                                {!hasRolled && (
                                  <button
                                    type="button"
                                    className={`primary-button ${
                                      isRolling ? 'roll-confirm' : ''
                                    }`}
                                    onClick={handleRollClick}
                                  >
                                    {isRolling
                                      ? '🛑 CHỐT KẾT QUẢ'
                                      : '🎲 LẮC XÚC XẮC'}
                                  </button>
                                )}

                                {hasRolled && (
                                  <button
                                    type="button"
                                    className="dark-button"
                                    onClick={() =>
                                      socket.emit(
                                        'END_TURN',
                                        roomIdRef.current
                                      )
                                    }
                                  >
                                    ⏭ QUA LƯỢT
                                  </button>
                                )}
                              </>
                            )}

                          <button
                            type="button"
                            className="trade-button"
                            onClick={openTradeModal}
                            disabled={activeOtherPlayers.length === 0}
                            title={
                              activeOtherPlayers.length === 0
                                ? 'Cần có người chơi khác để giao dịch'
                                : 'Mở giao dịch'
                            }
                          >
                            🤝 TRADE
                          </button>
                        </div>

                        <div className="quick-player-strip">
                          {gameState.players.map((player, index) => (
                            <div
                              className={`player-chip ${
                                player.playerId === currentPlayer?.playerId
                                  ? 'active'
                                  : ''
                              }`}
                              key={player.playerId}
                            >
                              <span
                                className="player-chip-dot"
                                style={{
                                  background:
                                    PLAYER_COLORS[
                                      index % PLAYER_COLORS.length
                                    ],
                                }}
                              />

                              <span className="player-chip-name">
                                {player.name}
                              </span>

                              <span className="player-chip-money">
                                {formatMoney(player.money)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </section>

                      <aside className="hud-panel hud-side-panel">
                        <section className="event-card">
                          <div className="event-card-title">
                            <span>🃏</span>
                            KHÍ VẬN / CƠ HỘI
                          </div>

                          <div className="event-card-content">
                            {latestCard.text}
                          </div>

                          {latestCard.owner && (
                            <div className="event-card-owner">
                              Bốc bởi {latestCard.owner}
                            </div>
                          )}
                        </section>

                        <section className="log-panel">
                          <div className="panel-heading panel-heading-small">
                            <div>
                              <span className="panel-kicker">MATCH FEED</span>
                              <h3>Nhật ký game</h3>
                            </div>

                            <span className="live-badge">
                              <span />
                              LIVE
                            </span>
                          </div>

                          <div className="game-log">
                            {logs.length === 0 ? (
                              <div className="log-empty">
                                Trận đấu chưa có sự kiện.
                              </div>
                            ) : (
                              logs.slice(-12).map((log, index) => (
                                <div
                                  className="log-line"
                                  key={`${log}-${index}`}
                                >
                                  <span className="log-bullet">•</span>
                                  <span>{log}</span>
                                </div>
                              ))
                            )}

                            <div ref={logEndRef} />
                          </div>
                        </section>
                      </aside>
                      </div>
                    </div>

                    {isMyTurn && pendingAction?.type === 'BUY_PROMPT' && (
                      <div className="action-overlay">
                        <div className="action-modal">
                          <span className="action-modal-kicker">
                            CƠ HỘI MUA
                          </span>

                          <h3>
                            {gameState.board[pendingAction.cellId]?.name}
                          </h3>

                          <p>
                            Bạn có muốn mua tài sản này với{' '}
                            <strong>
                              {formatMoney(pendingAction.price)}
                            </strong>{' '}
                            không?
                          </p>

                          <div className="action-modal-buttons">
                            <button
                              type="button"
                              className="primary-button"
                              onClick={() => {
                                socket.emit(
                                  'BUY_PROPERTY',
                                  roomIdRef.current
                                );
                                showToast(
                                  'success',
                                  'Đã gửi lệnh mua tài sản.',
                                  1800
                                );
                              }}
                            >
                              🏠 MUA NGAY
                            </button>

                            <button
                              type="button"
                              className="danger-button"
                              onClick={() => {
                                socket.emit(
                                  'SKIP_BUY',
                                  roomIdRef.current
                                );
                                showToast('info', 'Bạn đã bỏ qua cơ hội mua.', 1800);
                              }}
                            >
                              BỎ QUA
                            </button>
                          </div>
                        </div>
                      </div>
                    )}

                    {isMyTurn && pendingAction?.type === 'DEBT' && (
                      <div className="action-overlay debt-overlay">
                        <div className="action-modal debt-modal">
                          <span className="action-modal-kicker">
                            CẢNH BÁO TÀI CHÍNH
                          </span>

                          <div className="debt-icon">⚠️</div>

                          <h3>
                            Bạn đang nợ{' '}
                            {formatMoney(pendingAction.amount)}
                          </h3>

                          <p>
                            Hãy bán nhà hoặc cầm cố tài sản để đưa số dư về
                            mức an toàn.
                          </p>

                          <div className="action-modal-buttons">
                            <button
                              type="button"
                              className="danger-button"
                              onClick={() => {
                                socket.emit(
                                  'DECLARE_BANKRUPTCY',
                                  roomIdRef.current
                                );
                                showToast(
                                  'warning',
                                  'Đang xử lý yêu cầu phá sản...',
                                  2200
                                );
                              }}
                            >
                              ☠️ PHÁ SẢN
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        <section className="mobile-inventory">
          <div className="mobile-inventory-header">
            <div>
              <span className="panel-kicker">MY PORTFOLIO</span>
              <h2>🎒 Tài sản của bạn</h2>
            </div>

            <div className="mobile-money-card">
              <span>💰</span>
              {formatMoney(myPlayer?.money)}
            </div>
          </div>

          {myProperties.length === 0 ? (
            <div className="mobile-empty-properties">
              Bạn chưa sở hữu tài sản nào.
            </div>
          ) : (
            <div className="mobile-property-carousel">
              {myProperties.map((cell) => renderPropertyCard(cell, true))}
            </div>
          )}
        </section>

        <nav className="mobile-action-dock" aria-label="Thao tác game">
          <button
            type="button"
            className={`mobile-action-button mobile-action-main ${
              isRolling ? 'is-confirm' : ''
            }`}
            onClick={
              isMyTurn && !hasRolled && !pendingAction
                ? handleRollClick
                : hasRolled && isMyTurn && !pendingAction
                ? () => socket.emit('END_TURN', roomIdRef.current)
                : undefined
            }
            disabled={
              !isMyTurn ||
              Boolean(pendingAction) ||
              Boolean(myPlayer?.bankrupt)
            }
          >
            {isRolling
              ? '🛑 CHỐT'
              : hasRolled
              ? '⏭ QUA LƯỢT'
              : '🎲 LẮC XÚC XẮC'}
          </button>

          <button
            type="button"
            className="mobile-action-button mobile-action-trade"
            onClick={openTradeModal}
            disabled={activeOtherPlayers.length === 0}
          >
            🤝 TRADE
          </button>

          {myPlayer?.inJail && isMyTurn && !hasRolled ? (
            <button
              type="button"
              className="mobile-action-button mobile-action-jail"
              onClick={() =>
                socket.emit('PAY_JAIL_FINE', roomIdRef.current)
              }
              disabled={myPlayer.money < 50}
            >
              💸 RA TÙ
            </button>
          ) : (
            <button
              type="button"
              className="mobile-action-button mobile-action-log"
              onClick={() => {
                const feed = document.querySelector('.hud-scroll-area');
                feed?.scrollTo({
                  top: feed.scrollHeight,
                  behavior: 'smooth',
                });
              }}
            >
              📜 LOG
            </button>
          )}
        </nav>
      </main>

      {tradeModal.visible && (
        <div
          className="modal-overlay"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              setTradeModal(createEmptyTrade());
            }
          }}
        >
          <div className="modal-card trade-modal">
            <div className="modal-handle" />

            <div className="modal-header">
              <div>
                <span className="panel-kicker">PLAYER MARKET</span>
                <h2>🤝 Giao dịch tài sản</h2>
              </div>

              <button
                type="button"
                className="close-button"
                onClick={() => setTradeModal(createEmptyTrade())}
                aria-label="Đóng giao dịch"
              >
                ×
              </button>
            </div>

            <label className="field-label">
              Đối tác
              <select
                value={tradeModal.targetId}
                onChange={(event) =>
                  setTradeModal((prev) => ({
                    ...prev,
                    targetId: event.target.value,
                    reqCells: [],
                  }))
                }
              >
                <option value="">-- Chọn người chơi --</option>
                {activeOtherPlayers.map((player) => (
                  <option key={player.playerId} value={player.playerId}>
                    {player.name} — {formatMoney(player.money)}
                  </option>
                ))}
              </select>
            </label>

            <div className="trade-grid">
              <div className="trade-side trade-offer">
                <div className="trade-side-heading">
                  <span className="trade-side-icon">📤</span>
                  <div>
                    <span>BẠN ĐƯA</span>
                    <small>Tài sản / tiền</small>
                  </div>
                </div>

                <input
                  type="number"
                  min="0"
                  value={tradeModal.offerM}
                  onChange={(event) =>
                    setTradeModal((prev) => ({
                      ...prev,
                      offerM: Math.max(0, Number(event.target.value)),
                    }))
                  }
                  placeholder="Số tiền ($)"
                  inputMode="numeric"
                />

                <div className="trade-checkbox-list">
                  {myProperties.filter((cell) => cell.houses === 0).length ===
                  0 ? (
                    <span className="trade-empty">
                      Không có đất khả dụng.
                    </span>
                  ) : (
                    myProperties
                      .filter((cell) => cell.houses === 0)
                      .map((cell) => (
                        <label key={cell.id} className="trade-checkbox">
                          <input
                            type="checkbox"
                            checked={tradeModal.offerCells.includes(cell.id)}
                            onChange={(event) => {
                              setTradeModal((prev) => ({
                                ...prev,
                                offerCells: event.target.checked
                                  ? [...prev.offerCells, cell.id]
                                  : prev.offerCells.filter(
                                      (id) => id !== cell.id
                                    ),
                              }));
                            }}
                          />
                          <span>{cell.name}</span>
                        </label>
                      ))
                  )}
                </div>

                <div className="trade-summary">
                  {renderTradeProperties(tradeModal.offerCells)}
                </div>
              </div>

              <div className="trade-divider">↔</div>

              <div className="trade-side trade-request">
                <div className="trade-side-heading">
                  <span className="trade-side-icon">📥</span>
                  <div>
                    <span>BẠN NHẬN</span>
                    <small>Tài sản / tiền</small>
                  </div>
                </div>

                <input
                  type="number"
                  min="0"
                  value={tradeModal.reqM}
                  onChange={(event) =>
                    setTradeModal((prev) => ({
                      ...prev,
                      reqM: Math.max(0, Number(event.target.value)),
                    }))
                  }
                  placeholder="Số tiền ($)"
                  inputMode="numeric"
                />

                <div className="trade-checkbox-list">
                  {gameState.board.filter(
                    (cell) =>
                      cell.owner === tradeModal.targetId && cell.houses === 0
                  ).length === 0 ? (
                    <span className="trade-empty">
                      Chưa chọn đối tác hoặc đối tác không có đất khả dụng.
                    </span>
                  ) : (
                    gameState.board
                      .filter(
                        (cell) =>
                          cell.owner === tradeModal.targetId &&
                          cell.houses === 0
                      )
                      .map((cell) => (
                        <label key={cell.id} className="trade-checkbox">
                          <input
                            type="checkbox"
                            checked={tradeModal.reqCells.includes(cell.id)}
                            onChange={(event) => {
                              setTradeModal((prev) => ({
                                ...prev,
                                reqCells: event.target.checked
                                  ? [...prev.reqCells, cell.id]
                                  : prev.reqCells.filter(
                                      (id) => id !== cell.id
                                    ),
                              }));
                            }}
                          />
                          <span>{cell.name}</span>
                        </label>
                      ))
                  )}
                </div>

                <div className="trade-summary">
                  {renderTradeProperties(tradeModal.reqCells)}
                </div>
              </div>
            </div>

            <button
              type="button"
              className="primary-button full-width"
              onClick={() => {
                if (!tradeModal.targetId) {
                  showToast('warning', 'Hãy chọn đối tác giao dịch.');
                  return;
                }

                if (
                  tradeModal.offerM === 0 &&
                  tradeModal.reqM === 0 &&
                  tradeModal.offerCells.length === 0 &&
                  tradeModal.reqCells.length === 0
                ) {
                  showToast('warning', 'Hãy chọn ít nhất một thứ để giao dịch.');
                  return;
                }

                socket.emit('PROPOSE_TRADE', {
                  roomId: roomIdRef.current,
                  targetPlayerId: tradeModal.targetId,
                  offerMoney: tradeModal.offerM,
                  requestMoney: tradeModal.reqM,
                  offerCells: tradeModal.offerCells,
                  requestCells: tradeModal.reqCells,
                });

                setTradeModal(createEmptyTrade());
                showToast('success', 'Đã gửi lời mời giao dịch.', 3500);
              }}
            >
              GỬI LỜI MỜI GIAO DỊCH
            </button>
          </div>
        </div>
      )}

      {gameState.trades
        ?.filter((trade) => trade.toId === playerId)
        .map((trade) => {
          const sender = gameState.players.find(
            (player) => player.playerId === trade.fromId
          );

          return (
            <div className="modal-overlay" key={trade.id}>
              <div className="modal-card incoming-trade-card">
                <div className="incoming-trade-icon">🤝</div>

                <span className="panel-kicker">TRADE REQUEST</span>

                <h2>
                  Đề nghị từ {sender?.name || 'người chơi'}
                </h2>

                <p>
                  Họ đưa bạn{' '}
                  <strong>{formatMoney(trade.offerMoney)}</strong> và muốn
                  nhận <strong>{formatMoney(trade.requestMoney)}</strong> từ
                  bạn.
                </p>

                <div className="incoming-trade-grid">
                  <div>
                    <span className="incoming-label">HỌ ĐƯA</span>
                    <div>{renderTradeProperties(trade.offerCells)}</div>
                  </div>

                  <div>
                    <span className="incoming-label">HỌ MUỐN</span>
                    <div>{renderTradeProperties(trade.requestCells)}</div>
                  </div>
                </div>

                <div className="incoming-trade-actions">
                  <button
                    type="button"
                    className="success-button"
                    onClick={() => {
                      socket.emit('RESPOND_TRADE', {
                        roomId: roomIdRef.current,
                        tradeId: trade.id,
                        accept: true,
                      });

                      showToast('success', 'Đã chấp nhận giao dịch.', 2800);
                    }}
                  >
                    ✓ ĐỒNG Ý
                  </button>

                  <button
                    type="button"
                    className="danger-button"
                    onClick={() => {
                      socket.emit('RESPOND_TRADE', {
                        roomId: roomIdRef.current,
                        tradeId: trade.id,
                        accept: false,
                      });

                      showToast('info', 'Đã từ chối giao dịch.', 2600);
                    }}
                  >
                    × TỪ CHỐI
                  </button>
                </div>
              </div>
            </div>
          );
        })}

      {toast && (
        <div className={`toast toast-${toast.type}`} role="status">
          <span className="toast-icon">
            {toast.type === 'success'
              ? '✓'
              : toast.type === 'error'
              ? '!'
              : toast.type === 'warning'
              ? '⚠'
              : 'i'}
          </span>

          <span className="toast-message">{toast.message}</span>

          <button
            type="button"
            className="toast-close"
            onClick={() => setToast(null)}
            aria-label="Đóng thông báo"
          >
            ×
          </button>
        </div>
      )}
    </div>
  );
}
