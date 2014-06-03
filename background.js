chrome.app.runtime.onLaunched.addListener(function() {
  chrome.app.window.create('main.html', {
    'bounds': {
      'width': 410,
      'height': 230,
      'left': 100,
      'top': 100
    },
    minWidth: 410,
    minHeight: 230
  });
});
