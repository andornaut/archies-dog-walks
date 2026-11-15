// The parent build adapter resolves the current button sheets to this build's hashed files.
declare module "virtual:adw-button-skin" {
  const manifestUrl: string;
  export default manifestUrl;
}
