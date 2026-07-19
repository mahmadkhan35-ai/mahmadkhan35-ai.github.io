import { useEffect, useState } from 'react';
import styles from './BattleView.module.css';
import { BoardView } from './BoardView';
import { useAppStore } from '../app/store';

export function BattleView() {
  const state = useAppStore((s) => s.state);
  const lastError = useAppStore((s) => s.lastError);
  const moveHistory = useAppStore((s) => s.moveHistory);
  const restart = useAppStore((s) => s.restart);
  const battleMode = useAppStore((s) => s.battleMode);
  const setBattleMode = useAppStore((s) => s.setBattleMode);
  const online = useAppStore((s) => s.online);
  const repo = useAppStore((s) => s.repo);
  const activeDeckId = useAppStore((s) => s.activeDeckId);
  const decks = useAppStore((s) => s.decks);
  const setActiveDeckId = useAppStore((s) => s.setActiveDeckId);

  const [, tick] = useState(0);
  useEffect(() => online.subscribeStatus(() => tick((n) => n + 1)), [online]);

  const [joinCode, setJoinCode] = useState(() => {
    if (typeof window === 'undefined') return '';
    return new URLSearchParams(window.location.search).get('room') ?? '';
  });
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const onlineStatus = online.getStatus();
  const inviteUrl = online.getInviteUrl();
  const myColor = online.getMyColor();
  const activeDeck = decks.find((d) => d.id === activeDeckId) ?? decks[0];

  const status =
    battleMode === 'online'
      ? onlineStatus === 'waiting'
        ? 'Ожидание соперника…'
        : onlineStatus === 'playing'
          ? `Онлайн · вы ${myColor === 'white' ? 'белые' : 'чёрные'} · ход ${state.turn} · ${
              state.activePlayer === myColor ? 'ваш ход' : 'ход соперника'
            }`
          : onlineStatus === 'connecting'
            ? 'Подключение…'
            : onlineStatus === 'disconnected'
              ? 'Соединение потеряно'
              : 'Онлайн-лобби'
      : state.phase === 'gameOver'
        ? `Победа: ${state.winner === 'white' ? 'белые' : 'чёрные'}`
        : `Ход ${state.turn} · ${state.activePlayer === 'white' ? 'белые' : 'чёрные (ИИ)'}`;

  const placements = () => {
    const deck = repo.getDeck(activeDeckId);
    if (!deck || deck.placements.length < 16) {
      throw new Error('Выберите полную сохранённую колоду');
    }
    return deck.placements;
  };

  const createRoom = async () => {
    setBusy(true);
    try {
      await online.createRoom(placements());
    } catch {
      /* error via session */
    } finally {
      setBusy(false);
    }
  };

  const joinRoom = async () => {
    const code = joinCode.trim().toLowerCase();
    if (!code) return;
    setBusy(true);
    try {
      await online.joinRoom(code, placements());
    } catch {
      /* error via session */
    } finally {
      setBusy(false);
    }
  };

  const copyInvite = async () => {
    if (!inviteUrl) return;
    await navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  const showBoard =
    battleMode === 'ai' || onlineStatus === 'playing' || state.phase === 'gameOver';

  return (
    <section className={styles.wrap}>
      <div className={styles.hud}>
        <div>
          <h2 className={styles.title}>Поле боя</h2>
          <div className={styles.modeSwitch}>
            <button
              type="button"
              className={battleMode === 'ai' ? styles.modeActive : undefined}
              onClick={() => setBattleMode('ai')}
            >
              Против ИИ
            </button>
            <button
              type="button"
              className={battleMode === 'online' ? styles.modeActive : undefined}
              onClick={() => setBattleMode('online')}
            >
              Онлайн
            </button>
          </div>
          <p className={styles.status}>{status}</p>
          {lastError && <p className={styles.error}>{lastError}</p>}
        </div>
        <button type="button" className={styles.restart} onClick={restart}>
          {battleMode === 'online' ? 'Выйти / сброс' : 'Новая партия'}
        </button>
      </div>

      {battleMode === 'online' && onlineStatus !== 'playing' && (
        <div className={styles.lobby}>
          <label className={styles.lobbyField}>
            Колода для матча
            <select
              value={activeDeckId}
              onChange={(e) => setActiveDeckId(e.target.value)}
              disabled={busy || onlineStatus === 'waiting'}
            >
              {decks.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </label>
          <p className={styles.lobbyHint}>
            Активная: {activeDeck?.name ?? '—'}. Соперник получит вашу расстановку при входе в
            комнату.
          </p>
          <div className={styles.lobbyActions}>
            <button type="button" className={styles.primary} onClick={createRoom} disabled={busy}>
              Создать комнату
            </button>
            <div className={styles.joinRow}>
              <input
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value)}
                placeholder="код комнаты"
                disabled={busy || onlineStatus === 'waiting'}
              />
              <button type="button" onClick={joinRoom} disabled={busy || !joinCode.trim()}>
                Войти
              </button>
            </div>
          </div>
          {onlineStatus === 'waiting' && inviteUrl && (
            <div className={styles.invite}>
              <p>
                Комната <strong>{online.getRoomId()}</strong> — вы белые. Отправьте ссылку:
              </p>
              <code className={styles.inviteUrl}>{inviteUrl}</code>
              <button type="button" onClick={copyInvite}>
                {copied ? 'Скопировано' : 'Копировать ссылку'}
              </button>
            </div>
          )}
        </div>
      )}

      {showBoard && (
        <div className={styles.layout}>
          <BoardView />
          <aside className={styles.history} aria-label="История ходов">
            <h3 className={styles.historyTitle}>История</h3>
            {moveHistory.length === 0 ? (
              <p className={styles.historyEmpty}>Ходов пока нет</p>
            ) : (
              <ol className={styles.historyList}>
                {moveHistory.map((entry) => (
                  <li key={`${entry.ply}-${entry.text}`} className={styles.historyItem}>
                    <span className={styles.historyMeta}>
                      {entry.turn}
                      {entry.player === 'white' ? 'б' : 'ч'}
                    </span>
                    <span
                      className={
                        entry.player === 'white' ? styles.historyWhite : styles.historyBlack
                      }
                    >
                      {entry.text}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </aside>
        </div>
      )}

      <p className={styles.hint}>
        {battleMode === 'online'
          ? 'Создайте комнату и отправьте ссылку. Соединение peer-to-peer (PeerJS), отдельный сервер не нужен.'
          : 'Выберите фигуру, затем клетку. Рокировка — король на два поля к ладье.'}
      </p>
    </section>
  );
}
