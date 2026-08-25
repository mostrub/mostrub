import { Navigate, Route, Routes } from "react-router-dom";
import { Floor } from "./pages/Floor.tsx";

export function App() {
  return (
    <Routes>
      <Route path="/" element={<Floor />} />
      <Route path="/zelle/:dmc" element={<Floor />} />
      <Route path="/akte/:id" element={<Floor />} />
      <Route path="/linie" element={<Navigate to="/" replace />} />
      <Route path="/band" element={<Navigate to="/" replace />} />
      <Route path="/schicht" element={<Navigate to="/" replace />} />
      <Route path="/pin" element={<Navigate to="/" replace />} />
      <Route path="/see" element={<Navigate to="/" replace />} />
      <Route path="/zellen/:dmc" element={<Floor />} />
      <Route path="/akten/:id" element={<Floor />} />
      <Route path="/chronik" element={<Navigate to="/" replace />} />
      <Route path="/bank" element={<Navigate to="/" replace />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
