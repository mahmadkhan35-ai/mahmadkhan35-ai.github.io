# Chessforge

Браузерная шахматно-коллекционная игра: колоды с модификациями фигур, бой с ИИ и онлайн по ссылке-приглашению.

## Стек

- `@chessforge/engine` — правила
- `@chessforge/ai` — поиск хода и сборка колоды ИИ
- `@chessforge/client` — Vite + React (GitHub Pages)

Онлайн работает **peer-to-peer через PeerJS** (без отдельного игрового сервера), поэтому сайт можно хостить как статику на GitHub Pages.

## Локальный запуск

```bash
pnpm install
pnpm dev
```

Откроется Vite на `http://localhost:5173`.

```bash
pnpm test
pnpm build
```

## Деплой на GitHub Pages

1. Запушьте репозиторий на GitHub.
2. **Settings → Pages → Build and deployment → Source: GitHub Actions**.
3. Workflow [`.github/workflows/deploy-pages.yml`](.github/workflows/deploy-pages.yml) соберёт клиент с `VITE_BASE=/<имя-репо>/` и задеплоит.
4. Сайт: `https://<user>.github.io/<repo>/`.

Локальная проверка сборки «как на Pages» (подставьте имя репо):

```bash
VITE_BASE=/chessforge/ pnpm --filter @chessforge/client build
pnpm --filter @chessforge/client preview
```

> Белый экран после деплоя почти всегда значит, что `base` не совпадает с путём репозитория (ассеты ищутся в `/assets/...` вместо `/repo/assets/...`).

## Онлайн

На вкладке **Бой → Онлайн**:

1. Выберите сохранённую полную колоду.
2. **Создать комнату** — появится ссылка `?room=xxxxxx`.
3. Соперник открывает ссылку (или вводит код) и жмёт **Войти**.

Хост играет белыми и авторитетно применяет ходы; связь идёт через публичный брокер PeerJS + WebRTC.
