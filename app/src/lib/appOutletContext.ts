export type AppOutletContext = {
  onOpenContextMenu: (
    event: React.MouseEvent,
    type: "user" | "channel",
    id: number
  ) => void;
  onOpenProfile: (userId: number) => void;
};
