// Every page the site serves, shared by the smoke and visual tests.
export const pages = [
  { path: '/', title: 'DanielNG', nav: false },
  { path: '/i-am.html', title: 'DanielNG', nav: true },
  { path: '/my-experiences.html', title: 'DanielNG', nav: true },
  { path: '/and-my-thoughts.html', title: 'DanielNG', nav: true },
  { path: '/error.html', title: 'Oops! Error', nav: false },
];

export const viewports = [
  { name: 'mobile', width: 375, height: 812 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1440, height: 900 },
];
