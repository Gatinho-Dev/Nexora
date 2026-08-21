import { Routes, Route } from "react-router";
import Home from "./pages/Home";
import Login from "./pages/Login";
import Register from "./pages/Register";
import NotFound from "./pages/NotFound";
import { AppLayout } from "./pages/AppLayout";
import { ServerChannel } from "./pages/ServerChannel";
import { DMHome } from "./pages/DMHome";
import { DMConversation } from "./pages/DMConversation";
import { InvitePage } from "./pages/InvitePage";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/invite/:code" element={<InvitePage />} />
      <Route element={<AppLayout />}>
        <Route path="/channels/@me" element={<DMHome />} />
        <Route path="/channels/@me/:conversationId" element={<DMConversation />} />
        <Route path="/channels/:serverId/:channelId" element={<ServerChannel />} />
        <Route path="/channels/:serverId" element={<ServerChannel />} />
      </Route>
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
