# Trascrivo — Multilingual Video Transcription Platform

**Trascrivo** è una piattaforma web per la trascrizione automatica di video in italiano e in inglese. Incolla il link di un video da YouTube, TikTok, Instagram, Facebook, X/Twitter, Twitch, Vimeo, Reddit, Dailymotion, LinkedIn o oltre 1000 siti supportati, oppure carica un file audio/video dal tuo computer, e ottieni in pochi secondi una trascrizione precisa con timestamp, traduzione ed export in formati professionali.

Nessuna registrazione richiesta. La trascrizione nel browser mantiene l’audio interamente sul tuo dispositivo.

## Caratteristiche principali

- Trascrizione in secondi: sottotitoli nativi quando disponibili, altrimenti AI Whisper.
- Italiano e inglese: traduci l’intera trascrizione mantenendo i timestamp sincronizzati.
- Oltre 1000 siti supportati: YouTube, TikTok, Instagram, Facebook, X, Twitch, Vimeo, Reddit e molti altri.
- Timestamp cliccabili: clicca su una frase per saltare al punto esatto del video.
- Export professionale: TXT, SRT, VTT, Word (.doc), JSON o PDF.
- Privacy by design: nel browser l’audio non lascia mai il tuo dispositivo.
- Ricerca nel testo con evidenziazione e contatore dei risultati.
- Cronologia e condivisione con link pubblico.

## Come funziona

1. Incolla il link del video o carica un file audio/video.
2. Vengono recuperati i sottotitoli originali o, se mancanti, l’audio viene trascritto con Whisper AI.
3. Puoi tradurre in italiano o inglese, cercare nel testo, modificare ed esportare in SRT, VTT, TXT o Word.

## Stack tecnologico

- Next.js 16 con App Router e React 19
- TypeScript 5
- PostgreSQL con Drizzle ORM
- Tailwind CSS 4
- Whisper AI via Groq/OpenAI
- Whisper ONNX nel browser tramite Hugging Face Transformers
- yt-dlp per estrazione audio e sottotitoli

## Struttura del progetto

```
multilingual-video-transcription-platform/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── transcribe/
│   │   │   ├── transcripts/
│   │   │   ├── upload/
│   │   │   ├── media/
│   │   │   └── config/
│   │   ├── history/
│   │   ├── t/[id]/
│   │   ├── page.tsx
│   │   └── layout.tsx
│   ├── components/
│   │   ├── workspace/
│   │   ├── TranscribeForm.tsx
│   │   ├── HistoryList.tsx
│   │   └── Header.tsx
│   ├── db/
│   │   ├── schema.ts
│   │   └── index.ts
│   └── lib/
│       ├── client/
│       ├── server/
│       └── format.ts
├── drizzle.config.json
├── next.config.ts
├── package.json
└── tsconfig.json
```

## Avvio in sviluppo

Prerequisiti: Node.js 18+, PostgreSQL.

```bash
# Installa le dipendenze
npm install

# Configura le variabili d'ambiente
cp .env.example .env.local

# Avvia il database e le migrazioni
npm run db:push

# Avvia in sviluppo
npm run dev
```

## Variabili d'ambiente

| Variabile | Descrizione |
| --- | --- |
| `DATABASE_URL` | Connessione PostgreSQL |
| `OPENAI_API_KEY` | Chiave API OpenAI per Whisper |
| `GROQ_API_KEY` | Chiave API Groq come alternativa a OpenAI |
| `MYMEMORY_EMAIL` | Email per aumentare il limite MyMemory per la traduzione |

## Licenza

MIT
