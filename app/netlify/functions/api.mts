import app from "../../api/boot"

export default (request: Request) => app.fetch(request)

export const config = {
  path: "/api/*",
}
