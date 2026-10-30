export type AppOutletContext = {
  onOpenContextMenu: (
    event: React.MouseEvent,
    type: "user" | "channel" | "server",
    id: number
  ) => void;
  onOpenProfile: (userId: number) => void;
};
