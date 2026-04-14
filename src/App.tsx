import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Layout } from "./app/Layout";
import { Home } from "./app/pages/Home";
import { Tournaments } from "./app/pages/Tournaments";
import { HostTournament } from "./app/pages/Host";
import { Profile } from "./app/pages/Profile"; // 1. Add this import
import { TournamentDetails } from "./app/pages/TournamentDetails";
import { Admin } from "./app/pages/Admin";
import { Inbox } from "./app/pages/Inbox";
import { PublicProfile } from "./app/pages/PublicProfile";
import { GameProfile } from "./app/pages/GameProfile";
// git check
  

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="tournaments" element={<Tournaments />} />
          <Route path="host" element={<HostTournament />} />
          <Route path="profile" element={<Profile />} /> {/* 2. Add this route */}
          <Route path="/tournaments/:id" element={<TournamentDetails />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="inbox" element={<Inbox />} />
          <Route path="player/:id" element={<PublicProfile />} />
          <Route path="/player/:userId/game/:gameId" element={<GameProfile />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}