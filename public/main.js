// 平滑滚动
document.querySelectorAll('nav a[href^="#"]').forEach(anchor => {
  anchor.addEventListener('click', function(e) {
    const targetId = this.getAttribute('href');
    if (targetId === '#') return;

    const target = document.querySelector(targetId);
    if (target) {
      e.preventDefault();
      target.scrollIntoView({ behavior: 'smooth' });
    }
  });
});

// 二级页：根据 URL 参数加载对应的项目大图
var container = document.getElementById('project-images');
if (container) {
  var params = new URLSearchParams(window.location.search);
  var projectId = params.get('id') || '1';

  var projectImages = {
    '1': ['PJ1-1.jpg', 'PJ1-2.jpg', 'PJ1-3.jpg', 'PJ1-4.jpg', 'PJ1-5.jpg', 'PJ1-6.jpg'],
    '2': ['PJ2-1.jpg', 'PJ2-2.jpg', 'PJ2-3.jpg', 'PJ2-4.jpg', 'PJ2-5.jpg', 'PJ2-6.jpg']
  };

  var images = projectImages[projectId] || projectImages['1'];
  for (var i = 0; i < images.length; i++) {
    var img = document.createElement('img');
    img.src = images[i];
    img.alt = '项目详情图';
    img.style.cssText = 'display:block;width:100%;height:auto;';
    container.appendChild(img);
  }
}
