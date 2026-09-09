export type AccessOptions = {
  heltes: Array<{
    id: string;
    name: string;
    albas: Array<{
      id: string;
      name: string;
      positions: Array<{ id: string; name: string }>;
    }>;
  }>;
};
