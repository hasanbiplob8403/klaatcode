export interface User {
  id: string;
  orgId: string;
  name: string;
  email: string;
}

export interface Profile {
  userId: string;
  name: string;
  email: string;
  orgName: string;
}
