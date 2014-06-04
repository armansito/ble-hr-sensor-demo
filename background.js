chrome.app.runtime.onLaunched.addListener(function() {
  chrome.app.window.create('main.html', {
    'bounds': {
      'width': 610,
      'height': 400,
      'left': 100,
      'top': 100
    },
    minWidth: 610,
    minHeight: 400
  });
});
