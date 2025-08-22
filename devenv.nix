{ pkgs, ... }:

{
  packages = with pkgs; [
    pocketbase
  ];
  languages.javascript = {
    enable = true;
    npm.enable = true;
    npm.install.enable = true;
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
    pocketbase.exec = "vite --config common.config.js build && pocketbase serve --dev";
  };
  devcontainer = {
    enable = true;
    settings.customizations.vscode.extensions = [
      "bbenoist.Nix"
      "svelte.svelte-vscode"
      "esbenp.prettier-vscode"
      "eamodio.gitlens"
    ];
  };
}
