/** Map user status string to Tailwind color class. */
export function statusColor(status: string | undefined): string {
  switch (status) {
    case "online":
      return "bg-online";
    case "idle":
      return "bg-idle";
    case "dnd":
      return "bg-dnd";
    default:
      return "bg-offline";
  }
}