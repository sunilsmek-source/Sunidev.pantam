import { handleApi } from "../server.js";

export default async function handler(request, response) {
  await handleApi(request, response, "/api/chat");
}
