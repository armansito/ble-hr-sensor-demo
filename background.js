chrome.app.runtime.onLaunched.addListener(function() {
  chrome.app.window.create('main.html', {
    'bounds': {
      'width': 500,
      'height': 300,
      'left': 100,
      'top': 100
    },
    minWidth: 500,
    minHeight: 300
  });
});
