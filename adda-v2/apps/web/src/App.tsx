import { Archive, Clock3, FolderOpen, Landmark, Search, Waves } from "lucide-react";
import { NavLink, Navigate, Route, Routes } from "react-router-dom";
import { de } from "./i18n/de.ts";
import { AktePage } from "./pages/Akte.tsx";
import { AktenPage } from "./pages/Akten.tsx";
import { BankPage } from "./pages/Bank.tsx";
import { ChronikPage } from "./pages/Chronik.tsx";
import { SchichtPage } from "./pages/Schicht.tsx";
import { SeePage } from "./pages/See.tsx";
import { ZellePage } from "./pages/Zelle.tsx";

const rooms = [
  { to: "/akten", label: de.rooms.akten, icon: FolderOpen },
  { to: "/zellen", label: de.rooms.zelle, icon: Search },
  { to: "/chronik", label: de.rooms.chronik, icon: Clock3 },
  { to: "/bank", label: de.rooms.bank, icon: Landmark },
  { to: "/see", label: de.rooms.see, icon: Waves },
  { to: "/schicht", label: de.rooms.schicht, icon: Archive },
] as const;

export function App() {
  return (
    <div className="min-h-screen bg-paper text-ink">
      <div className="mx-auto flex min-h-screen max-w-6xl">
        <aside className="w-56 shrink-0 border-r border-rule px-5 py-8">
          <p className="font-serif text-2xl leading-none">{de.product}</p>
          <p className="mt-2 text-xs uppercase tracking-[0.18em] text-muted">{de.tag}</p>
          <nav className="mt-10 flex flex-col gap-2">
            {rooms.map((room) => (
              <NavLink
                key={room.to}
                to={room.to}
                className={({ isActive }) =>
                  `flex items-center gap-2 px-2 py-2 text-sm ${
                    isActive ? "bg-ink text-paper" : "hover:bg-paper-edge"
                  }`
                }
              >
                <room.icon />
                {room.label}
              </NavLink>
            ))}
          </nav>
        </aside>
        <main className="ledger-rule flex-1 px-8 py-8">
          <Routes>
            <Route path="/" element={<Navigate to="/akten" replace />} />
            <Route path="/akten" element={<AktenPage />} />
            <Route path="/akten/:id" element={<AktePage />} />
            <Route path="/zellen" element={<ZellePage />} />
            <Route path="/zellen/:dmc" element={<ZellePage />} />
            <Route path="/chronik" element={<ChronikPage />} />
            <Route path="/bank" element={<BankPage />} />
            <Route path="/see" element={<SeePage />} />
            <Route path="/schicht" element={<SchichtPage />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}
