import { NavLink, Navigate, Route, Routes, useParams } from "react-router-dom";
import { de } from "./i18n/de.ts";
import { AktePage } from "./pages/Akte.tsx";
import { BandPage } from "./pages/Band.tsx";
import { LiniePage } from "./pages/Linie.tsx";
import { SchichtPage } from "./pages/Schicht.tsx";
import { SeePage } from "./pages/See.tsx";
import { ZellePage } from "./pages/Zelle.tsx";

const rooms = [
  { to: "/linie", label: de.rooms.linie },
  { to: "/band", label: de.rooms.band },
  { to: "/zelle", label: de.rooms.zelle },
  { to: "/schicht", label: de.rooms.schicht },
  { to: "/pin", label: de.rooms.pin },
] as const;

export function App() {
  return (
    <div className="min-h-screen bg-floor text-white">
      <header className="flex items-center justify-between border-b border-line px-5 py-3">
        <div>
          <p className="font-display text-3xl leading-none tracking-wide">{de.product}</p>
          <p className="text-xs text-mist">{de.tag}</p>
        </div>
        <nav className="flex gap-1">
          {rooms.map((room) => (
            <NavLink
              key={room.to}
              to={room.to}
              className={({ isActive }) =>
                `px-3 py-2 font-display text-xl tracking-wide ${
                  isActive ? "bg-amber text-floor" : "text-mist hover:text-white"
                }`
              }
            >
              {room.label}
            </NavLink>
          ))}
        </nav>
      </header>
      <main className="px-5 py-6">
        <Routes>
          <Route path="/" element={<Navigate to="/linie" replace />} />
          <Route path="/linie" element={<LiniePage />} />
          <Route path="/band" element={<BandPage />} />
          <Route path="/zelle" element={<ZellePage />} />
          <Route path="/zelle/:dmc" element={<ZellePage />} />
          <Route path="/zellen" element={<Navigate to="/zelle" replace />} />
          <Route path="/zellen/:dmc" element={<ParamRedirect prefix="/zelle" />} />
          <Route path="/schicht" element={<SchichtPage />} />
          <Route path="/pin" element={<SeePage />} />
          <Route path="/see" element={<Navigate to="/pin" replace />} />
          <Route path="/akte/:id" element={<AktePage />} />
          <Route path="/akten" element={<Navigate to="/linie" replace />} />
          <Route path="/akten/:id" element={<ParamRedirect prefix="/akte" />} />
          <Route path="/chronik" element={<Navigate to="/band" replace />} />
          <Route path="/bank" element={<Navigate to="/linie" replace />} />
        </Routes>
      </main>
    </div>
  );
}

function ParamRedirect({ prefix }: { prefix: string }) {
  const params = useParams();
  const value = Object.values(params)[0] ?? "";
  return <Navigate to={`${prefix}/${value}`} replace />;
}
