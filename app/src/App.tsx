import { lazy, Suspense, type ReactNode } from "react";
import { Routes, Route, useParams } from "react-router";
import { NexoraAppIcon } from "@/components/NexoraBrand";

const Landing = lazy(() => import("./pages/Landing"));
const Login = lazy(() => import("./pages/Login"));
const Register = lazy(() => import("./pages/Register"));
const NotFound = lazy(() => import("./pages/NotFound"));
const AppLayout = lazy(() =>
  import("./pages/AppLayout").then(module => ({ default: module.AppLayout }))
);
const ServerChannel = lazy(() =>
  import("./pages/ServerChannel").then(module => ({
    default: module.ServerChannel,
  }))
);
const DMHome = lazy(() =>
  import("./pages/DMHome").then(module => ({ default: module.DMHome }))
);
const DMConversation = lazy(() =>
  import("./pages/DMConversation").then(module => ({
    default: module.DMConversation,
  }))
);
const DMRequests = lazy(() =>
  import("./pages/DMRequests").then(module => ({ default: module.DMRequests }))
);
const FriendsPage = lazy(() =>
  import("./pages/FriendsPage").then(module => ({
    default: module.FriendsPage,
  }))
);
const OfficialAnnouncements = lazy(() =>
  import("./pages/OfficialAnnouncements").then(module => ({
    default: module.OfficialAnnouncements,
  }))
);
const NexoraAdminPanel = lazy(() =>
  import("./pages/NexoraAdminPanel").then(module => ({
    default: module.NexoraAdminPanel,
  }))
);
const InvitePage = lazy(() =>
  import("./pages/InvitePage").then(module => ({ default: module.InvitePage }))
);
const GroupInvitePage = lazy(() =>
  import("./pages/GroupInvitePage").then(module => ({
    default: module.GroupInvitePage,
  }))
);
const ThreadViewPage = lazy(() =>
  import("./components/ThreadView").then(module => ({
    default: module.ThreadView,
  }))
);
const LegalPage = lazy(() =>
  import("./pages/LegalPage").then(module => ({ default: module.LegalPage }))
);

function PageLoader() {
  return (
    <main
      className="flex min-h-[100dvh] items-center justify-center bg-chat"
      aria-busy="true"
    >
      <NexoraAppIcon className="h-12 w-12 animate-pulse" />
      <span className="sr-only" role="status">
        Carregando...
      </span>
    </main>
  );
}

function ThreadViewWrapper() {
  const params = useParams();
  return (
    <ThreadViewPage
      serverId={Number(params.serverId)}
    />
  );
}

function Deferred({ children }: { children: ReactNode }) {
  return <Suspense fallback={<PageLoader />}>{children}</Suspense>;
}

export default function App() {
  return (
    <Routes>
      <Route
        path="/"
        element={
          <Deferred>
            <Landing />
          </Deferred>
        }
      />
      <Route
        path="/login"
        element={
          <Deferred>
            <Login />
          </Deferred>
        }
      />
      <Route
        path="/register"
        element={
          <Deferred>
            <Register />
          </Deferred>
        }
      />
      <Route
        path="/invite/:code"
        element={
          <Deferred>
            <InvitePage />
          </Deferred>
        }
      />
      <Route
        path="/invite/group/:code"
        element={
          <Deferred>
            <GroupInvitePage />
          </Deferred>
        }
      />
      <Route
        path="/legal/terms"
        element={
          <Deferred>
            <LegalPage kind="terms" />
          </Deferred>
        }
      />
      <Route
        path="/legal/guidelines"
        element={
          <Deferred>
            <LegalPage kind="guidelines" />
          </Deferred>
        }
      />
      <Route
        element={
          <Deferred>
            <AppLayout />
          </Deferred>
        }
      >
        <Route
          path="/channels/@me"
          element={
            <Deferred>
              <DMHome />
            </Deferred>
          }
        />
        <Route
          path="/channels/@me/friends"
          element={
            <Deferred>
              <FriendsPage />
            </Deferred>
          }
        />
        <Route
          path="/channels/@me/official"
          element={
            <Deferred>
              <OfficialAnnouncements />
            </Deferred>
          }
        />
        <Route
          path="/channels/@me/requests"
          element={
            <Deferred>
              <DMRequests />
            </Deferred>
          }
        />
        <Route
          path="/channels/@me/:conversationId"
          element={
            <Deferred>
              <DMConversation />
            </Deferred>
          }
        />
        <Route
          path="/nexora-admin"
          element={
            <Deferred>
              <NexoraAdminPanel />
            </Deferred>
          }
        />
        <Route
          path="/channels/:serverId/:channelId/t/:threadId"
          element={
            <Deferred>
              <ThreadViewWrapper />
            </Deferred>
          }
        />
        <Route
          path="/channels/:serverId/:channelId"
          element={
            <Deferred>
              <ServerChannel />
            </Deferred>
          }
        />
        <Route
          path="/channels/:serverId"
          element={
            <Deferred>
              <ServerChannel />
            </Deferred>
          }
        />
      </Route>
      <Route
        path="*"
        element={
          <Deferred>
            <NotFound />
          </Deferred>
        }
      />
    </Routes>
  );
}
