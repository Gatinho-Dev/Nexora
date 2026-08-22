import { lazy, Suspense, type ReactNode } from "react";
import { Routes, Route } from "react-router";

const Home = lazy(() => import("./pages/Home"));
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
const InvitePage = lazy(() =>
  import("./pages/InvitePage").then(module => ({ default: module.InvitePage }))
);

function PageLoader() {
  return (
    <main
      className="flex min-h-[100dvh] items-center justify-center bg-[#313338]"
      aria-busy="true"
    >
      <div className="nexora-mark flex h-12 w-12 animate-pulse items-center justify-center rounded-[14px] font-black text-white">
        N
      </div>
      <span className="sr-only" role="status">
        Carregando...
      </span>
    </main>
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
            <Home />
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
          path="/channels/@me/:conversationId"
          element={
            <Deferred>
              <DMConversation />
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
