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
    PALA_VERSION = "dev";
    PALA_SUPERUSER_EMAIL = "admin@palacms.internal";
    PALA_SUPERUSER_PASSWORD = "test1234";
    PALA_USER_EMAIL = "user@palacms.internal";
    PALA_USER_PASSWORD = "test1234";
    PALA_DISABLE_USAGE_STATS = "true";
  };
  processes = {
    app-dev.exec = "vite --config app.config.js dev";
    common-build.exec = "vite --config common.config.js build --watch";
    server.exec = "wgo -dir server go run -C server ./cmd serve --dev --dir ../pb_data";
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
