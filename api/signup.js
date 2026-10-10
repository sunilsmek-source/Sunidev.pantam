import { handleApi } from "../server.js";

export default async function signup(request, response) {
  await handleApi(request, response, "/api/signup");
}
