let user = { userId: "creator-1", fullName: "Creador", displayName: "Creador" };
export function setUser(next) {
  user = next;
}
export async function getChatGPTUser() {
  return user;
}

export const getAppUser = getChatGPTUser;
