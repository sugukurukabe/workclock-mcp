export const UI_RESOURCE_URI = 'ui://workclock/timer.html';
export const UI_MIME_TYPE = 'text/html;profile=mcp-app';

export const UI_CSP = {
  defaultSrc: "'none'",
  scriptSrc: "'self'",
  styleSrc: "'self' 'unsafe-inline'",
  imgSrc: 'data:',
  connectSrc: "'none'",
  frameSrc: "'none'",
  objectSrc: "'none'",
  baseUri: "'none'",
  formAction: "'none'",
};

export function uiToolMeta() {
  return {
    ui: {
      resourceUri: UI_RESOURCE_URI,
      csp: UI_CSP,
    },
  };
}
