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

  // [文件名, 宽, 高]：保留原始画质与原分辨率，仅用于提前占位，避免图片加载时页面跳动
  var projectImages = {
    '1': [
      ['PJ1-1.jpg', 3681, 7719],
      ['PJ1-2.jpg', 3681, 11234],
      ['PJ1-3.jpg', 3681, 8198],
      ['PJ1-4.jpg', 3681, 2913],
      ['PJ1-5.jpg', 3681, 5379],
      ['PJ1-6.jpg', 3681, 8888]
    ],
    '2': [
      ['PJ2-1.jpg', 3681, 8936],
      ['PJ2-2.jpg', 3681, 3562],
      ['PJ2-3.jpg', 3681, 3885],
      ['PJ2-4.jpg', 3681, 6422],
      ['PJ2-5.jpg', 3681, 4524],
      ['PJ2-6.jpg', 3681, 3344]
    ]
  };

  var images = projectImages[projectId] || projectImages['1'];
  for (var i = 0; i < images.length; i++) {
    var img = document.createElement('img');
    img.src = images[i][0];
    img.alt = '项目详情图';
    img.width = images[i][1];
    img.height = images[i][2];
    img.decoding = 'async';
    if (i === 0) {
      // 首图就是首屏内容，优先下载
      img.fetchPriority = 'high';
    } else {
      // 其余长图等滚动到附近再下载，避免一次性拉取全部原图
      img.loading = 'lazy';
    }
    img.style.cssText = 'display:block;width:100%;height:auto;';
    container.appendChild(img);
  }
}
