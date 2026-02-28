{ pkgs, ... }:

{
  packages = with pkgs; [
    wgo
  ];
  languages.javascript = {
    enable = true;
    package = pkgs.nodejs-slim_22;
    npm.enable = true;
    npm.install.enable = true;
  };
  languages.go = {
    enable = true;
  };
  env = {
    PALA_SUPERUSER_EMAIL = "admin@palacms.internal";
    PALA_SUPERUSER_PASSWORD = "test1234";
    PALA_USER_EMAIL = "user@palacms.internal";
    PALA_USER_PASSWORD = "test1234";
    PALA_DISABLE_USAGE_STATS = "true";
    # bind pocketbase to all interfaces so host can reach it from WSL/devcontainer
    PB_HTTP_ADDR = "0.0.0.0:8090";
  };
  processes = {
    app-dev.exec = "vite --config app.config.js dev --host";
    common-build.exec = "vite --config common.config.js build --watch";
    server.exec = "wgo -dir internal go run . serve --dev";
  };
  devcontainer = {
    enable = true;
    settings.customizations.vscode.extensions = [
      "bbenoist.Nix"
      "svelte.svelte-vscode"
      "esbenp.prettier-vscode"
      "eamodio.gitlens"
      "golang.go"
    ];
  };
}
