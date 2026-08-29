export type ShellStatus = {
  name: string;
  message: string;
};

export function getShellStatus(): ShellStatus {
  return {
    name: "Sake Sense",
    message: "The local development environment is ready.",
  };
}
