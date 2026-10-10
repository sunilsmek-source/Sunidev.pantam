import { handleApi } from "../server.js";

export default async function chat(request, response) {
  await handleApi(request, response, "/api/chat");
}
