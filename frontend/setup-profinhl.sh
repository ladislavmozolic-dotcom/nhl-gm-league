#!/bin/bash

echo "🏒 Vytváram ProfiNHL redesign súbory..."

# Priečinky
mkdir -p app/players/[id]
mkdir -p app/teams/[slug]
mkdir -p app/games/[id]
mkdir -p app/standings
mkdir -p app/schedule
mkdir -p app/transactions
mkdir -p app/all-rosters
mkdir -p app/lines
mkdir -p app/captains
mkdir -p app/coaches
mkdir -p app/salary-cap
mkdir -p app/signings
mkdir -p app/draft/projection
mkdir -p app/prospects
mkdir -p app/trades
mkdir -p app/free-agents
mkdir -p app/rules
mkdir -p app/api/teams
mkdir -p app/api/games/today
mkdir -p app/api/players
mkdir -p components
mkdir -p lib
mkdir -p scripts

# globals.css
cat > app/globals.css << 'EOF'
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --bg-primary: #0a1628;
  --bg-card: #0f1d32;
}

body {
  background-color: var(--bg-primary);
  color: #f1f5f9;
}

::-webkit-scrollbar { width: 6px; height: 6px; }
::-webkit-scrollbar-track { background: var(--bg-primary); }
::-webkit-scrollbar-thumb { background: #1e3a5f; border-radius: 3px; }

@layer components {
  .card { @apply bg-[#0f1d32] border border-slate-700/30 rounded-xl; }
  .section-title { @apply text-lg font-bold text-white flex items-center gap-2 mb-4; }
  .section-title::before { content: ''; @apply w-1 h-5 bg-blue-500 rounded-full; }
  .table-header { @apply bg-slate-800/60 text-slate-400 text-[11px] font-bold uppercase tracking-wider; }
  .table-row { @apply border-t border-slate-700/20 hover:bg-slate-800/30 transition-colors; }
}
EOF

# lib/prisma.ts
cat > lib/prisma.ts << 'EOF'
import { PrismaClient } from "@prisma/client";
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };
export const prisma = globalForPrisma.prisma ?? new PrismaClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
EOF

echo "✅ Základné súbory vytvorené"
echo "🏒 Teraz skopíruj obsahy komponentov ručne z nižšie uvedených blokov..."

