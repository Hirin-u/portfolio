import React, { useState, useEffect, useRef } from 'react';
import { CloudUpload, ChevronDown, Type, Volume2, VolumeX, Plus, X } from 'lucide-react';

interface SavedStory {
  id: string;
  subject: string;
  text: string;
  date: string;
  image?: string;
  season?: string;
  timeOfDay?: string;
  weather?: string;
  scene?: string;
  intensity?: number;
  fontFamily?: string;
  fontSize?: number;
}

const AUDIO_FILES: Record<string, string> = {
  morning: 'morning.mp3',
  sunny: 'https://files.catbox.moe/z1q5mq.mp3',
  bamboo_rain: 'https://files.catbox.moe/3weygr.mp3',
  bamboo_morning: 'https://files.catbox.moe/z1q5mq.mp3',
  bamboo_thunderstorm: 'https://files.catbox.moe/jpjqqp.mp3'
};

class AudioManager {
  private audios: Record<string, HTMLAudioElement> = {};
  private targetVolumes: Record<string, number> = {};
  public muted = true;
  private initialized = false;
  private fadeInterval: number | null = null;
  public unlocked = false;

  init() {
    if (this.initialized) return;
    Object.entries(AUDIO_FILES).forEach(([key, src]) => {
      const audio = new Audio(src);
      audio.loop = true;
      audio.volume = 0;
      audio.addEventListener('timeupdate', () => {
        if (audio.duration && audio.currentTime >= audio.duration - 0.15) {
          audio.currentTime = 0.05;
        }
      });
      this.audios[key] = audio;
      this.targetVolumes[key] = 0;
    });
    this.initialized = true;
    this.fadeInterval = window.setInterval(() => this.updateVolumes(), 50);
  }

  unlock() {
    if (this.unlocked) return;
    if (!this.initialized) this.init();
    Object.values(this.audios).forEach(audio => {
      audio.play().catch(() => {});
    });
    this.unlocked = true;
  }

  private updateVolumes() {
    const fadeRate = 0.02;
    Object.entries(this.audios).forEach(([key, audio]) => {
      const target = this.muted ? 0 : (this.targetVolumes[key] || 0);
      let current = audio.volume;
      if (Math.abs(current - target) > 0.01) {
        if (current < target) {
          current = Math.min(current + fadeRate, target);
        } else {
          current = Math.max(current - fadeRate, target);
        }
        audio.volume = current;
      } else {
        audio.volume = target;
      }
      if (audio.volume > 0 && audio.paused && this.unlocked) {
        audio.play().catch(e => console.warn(`Audio play failed for ${key}:`, e));
      } else if (audio.volume === 0 && target === 0 && !audio.paused) {
        audio.pause();
      }
    });
  }

  play(activeKeys: string[], intensity: number) {
    if (!this.initialized) this.init();
    const normalizedIntensity = intensity / 100;
    Object.keys(this.audios).forEach(key => {
      if (activeKeys.includes(key) && !this.muted) {
        if (['rain'].includes(key)) {
          this.targetVolumes[key] = Math.max(0.1, normalizedIntensity);
        } else if (key === 'bamboo_rain' || key === 'bamboo_morning' || key === 'bamboo_thunderstorm') {
          this.targetVolumes[key] = 0.3;
        } else {
          this.targetVolumes[key] = 0.5;
        }
      } else {
        this.targetVolumes[key] = 0;
      }
    });
  }

  stop() {
    Object.keys(this.targetVolumes).forEach(key => {
      this.targetVolumes[key] = 0;
    });
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.muted) {
      this.stop();
    }
    return this.muted;
  }
}

const audioManager = new AudioManager();

const WeatherCanvas = ({ weather, intensity, bgImage }: { weather: string, intensity: number, bgImage: string }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const glRef = useRef<WebGLRenderingContext | null>(null);
  const programRef = useRef<WebGLProgram | null>(null);
  const textureRef = useRef<WebGLTexture | null>(null);
  const imageSizeRef = useRef<{width: number, height: number}>({width: 1, height: 1});
  const particlesRef = useRef<any[]>([]);

  const vertexShaderSource = `
    attribute vec2 position;
    varying vec2 vUv;
    void main() {
      vUv = position * 0.5 + 0.5;
      vUv.y = 1.0 - vUv.y;
      gl_Position = vec4(position, 0.0, 1.0);
    }
  `;

  const fragmentShaderSource = `
    precision highp float;
    uniform vec2 u_resolution;
    uniform vec2 u_imageResolution;
    uniform float u_time;
    uniform sampler2D u_texture;
    uniform float u_intensity;
    varying vec2 vUv;
    vec3 N13(float p) {
      vec3 p3 = fract(vec3(p) * vec3(.1031,.11369,.13787));
      p3 += dot(p3, p3.yzx + 19.19);
      return fract(vec3((p3.x + p3.y)*p3.z, (p3.x+p3.z)*p3.y, (p3.y+p3.z)*p3.x));
    }
    vec4 N14(float t) {
      return fract(sin(t*vec4(123., 1024., 1456., 264.))*vec4(6547., 345., 8799., 1564.));
    }
    float N(float t) {
      return fract(sin(t*12345.564)*7658.76);
    }
    float Saw(float b, float t) {
      return smoothstep(0., b, t)*smoothstep(1., b, t);
    }
    vec2 DropLayer2(vec2 uv, float t) {
      vec2 UV = uv;
      uv.y += t*0.75;
      vec2 a = vec2(6., 1.);
      vec2 grid = a*2.;
      vec2 id = floor(uv*grid);
      float colShift = N(id.x);
      uv.y += colShift;
      id = floor(uv*grid);
      vec3 n = N13(id.x*35.2+id.y*2376.1);
      vec2 st = fract(uv*grid)-vec2(.5, 0);
      float x = n.x-.5;
      float y = UV.y*20.;
      float wiggle = sin(y+sin(y));
      x += wiggle*(.5-abs(x))*(n.z-.5);
      x *= .7;
      float ti = fract(t+n.z);
      y = (Saw(.85, ti)-.5)*.9+.5;
      vec2 p = vec2(x, y);
      float d = length((st-p)*a.yx);
      float mainDrop = smoothstep(.4, .0, d);
      float r = sqrt(smoothstep(1., y, st.y));
      float cd = abs(st.x-x);
      float trail = smoothstep(.23*r, .15*r*r, cd);
      float trailFront = smoothstep(-.02, .02, st.y-y);
      trail *= trailFront*r*r;
      y = UV.y;
      float trail2 = smoothstep(.2*r, .0, cd);
      float droplets = max(0., (sin(y*(1.-y)*120.)-st.y))*trail2*trailFront*n.z;
      y = fract(y*10.)+(st.y-.5);
      float dd = length(st-vec2(x, y));
      droplets = smoothstep(.3, 0., dd);
      float m = mainDrop+droplets*r*trailFront;
      return vec2(m, trail);
    }
    float StaticDrops(vec2 uv, float t) {
      uv *= 40.;
      vec2 id = floor(uv);
      uv = fract(uv)-.5;
      vec3 n = N13(id.x*107.45+id.y*3543.654);
      vec2 p = (n.xy-.5)*.7;
      float d = length(uv-p);
      float fade = Saw(.025, fract(t+n.z));
      float c = smoothstep(.3, 0., d)*fract(n.z*10.)*fade;
      return c;
    }
    vec2 Drops(vec2 uv, float t, float l0, float l1, float l2) {
      float s = StaticDrops(uv, t)*l0;
      vec2 m1 = DropLayer2(uv, t)*l1;
      vec2 m2 = DropLayer2(uv*1.85, t)*l2;
      float c = s+m1.x+m2.x;
      c = smoothstep(.3, 1., c);
      return vec2(c, max(m1.y*l0, m2.y*l1));
    }
    void main() {
      vec2 uv = gl_FragCoord.xy / u_resolution.xy;
      vec2 ratio = vec2(
        min((u_resolution.x / u_resolution.y) / (u_imageResolution.x / u_imageResolution.y), 1.0),
        min((u_resolution.y / u_resolution.x) / (u_imageResolution.y / u_imageResolution.x), 1.0)
      );
      vec2 texUv = vec2(
        vUv.x * ratio.x + (1.0 - ratio.x) * 0.5,
        vUv.y * ratio.y + (1.0 - ratio.y) * 0.5
      );
      float t = u_time * 0.2 * (0.5 + u_intensity * 0.5);
      if (u_intensity <= 0.0) {
        gl_FragColor = texture2D(u_texture, texUv);
        return;
      }
      vec2 dropUv = uv;
      dropUv.x *= u_resolution.x / u_resolution.y;
      float dropScale = 1.0 - u_intensity * 0.3;
      dropUv /= dropScale;
      vec2 drops = Drops(dropUv, t, 1.0, 1.0, 1.0);
      vec2 e = vec2(.001, 0.);
      float cx = Drops(dropUv+e, t, 1.0, 1.0, 1.0).x;
      float cy = Drops(dropUv+e.yx, t, 1.0, 1.0, 1.0).x;
      vec2 n = vec2(cx-drops.x, cy-drops.x);
      vec4 bgSample = texture2D(u_texture, texUv);
      vec2 refUv = texUv + n * 0.2 * u_intensity;
      vec4 clearSample = texture2D(u_texture, refUv);
      float dropMask = smoothstep(0.0, 0.1, drops.x);
      vec4 col = mix(bgSample, clearSample, dropMask);
      vec3 normal3 = normalize(vec3(n.x * 3.0, n.y * 3.0, 1.0));
      vec3 bottomLightDir = normalize(vec3(0.0, 1.0, 0.4));
      float bottomBounce = max(0.0, dot(normal3, bottomLightDir));
      float bottomHighlight = pow(bottomBounce, 15.0) * drops.x * 1.5;
      col.rgb += vec3(bottomHighlight);
      float shadow = mix(1.0, 0.8, smoothstep(0.1, 0.4, drops.x) * smoothstep(0.9, 0.5, drops.x));
      col.rgb *= shadow;
      gl_FragColor = vec4(col.rgb, 1.0);
    }
  `;

  const compileShader = (gl: WebGLRenderingContext, type: number, source: string) => {
    const shader = gl.createShader(type);
    if (!shader) return null;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.error('Shader compile error:', gl.getShaderInfoLog(shader));
      gl.deleteShader(shader);
      return null;
    }
    return shader;
  };

  const loadTexture = (gl: WebGLRenderingContext, url: string) => {
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 0]));
    const image = new Image();
    if (url.startsWith('http')) {
      image.crossOrigin = "anonymous";
    }
    image.onload = () => {
      imageSizeRef.current = { width: image.width, height: image.height };
      gl.bindTexture(gl.TEXTURE_2D, texture);
      try {
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
      } catch (e) {
        console.error("Failed to load texture into WebGL:", e);
        return;
      }
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    };
    image.src = url;
    return texture;
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (weather === 'rain' || weather === 'thunderstorm') {
      const gl = canvas.getContext('webgl');
      if (!gl) {
        console.error("WebGL not supported");
        return;
      }
      glRef.current = gl;
      const vertexShader = compileShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
      const fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);
      if (!vertexShader || !fragmentShader) return;
      const program = gl.createProgram();
      if (!program) return;
      gl.attachShader(program, vertexShader);
      gl.attachShader(program, fragmentShader);
      gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        console.error('Program link error:', gl.getProgramInfoLog(program));
        return;
      }
      programRef.current = program;
      const vertices = new Float32Array([-1.0, -1.0, 1.0, -1.0, -1.0, 1.0, -1.0, 1.0, 1.0, -1.0, 1.0, 1.0]);
      const buffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
      const positionLocation = gl.getAttribLocation(program, "position");
      gl.enableVertexAttribArray(positionLocation);
      gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);
      textureRef.current = loadTexture(gl, bgImage);
    } else {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        glRef.current = null;
      }
    }

    let animationFrameId: number;
    let startTime = performance.now();

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      if (glRef.current) {
        glRef.current.viewport(0, 0, canvas.width, canvas.height);
      }
    };

    window.addEventListener('resize', resize);
    resize();

    if (weather !== 'snow' && weather !== 'hail') particlesRef.current = [];

    const render = (time: number) => {
      if ((weather === 'rain' || weather === 'thunderstorm') && glRef.current && programRef.current) {
        const gl = glRef.current;
        const program = programRef.current;
        gl.useProgram(program);
        const resolutionLocation = gl.getUniformLocation(program, "u_resolution");
        gl.uniform2f(resolutionLocation, canvas.width, canvas.height);
        const imageResolutionLocation = gl.getUniformLocation(program, "u_imageResolution");
        gl.uniform2f(imageResolutionLocation, imageSizeRef.current.width, imageSizeRef.current.height);
        const timeLocation = gl.getUniformLocation(program, "u_time");
        gl.uniform1f(timeLocation, (time - startTime) / 1000.0);
        const intensityLocation = gl.getUniformLocation(program, "u_intensity");
        gl.uniform1f(intensityLocation, intensity / 100.0);
        if (textureRef.current) {
          const textureLocation = gl.getUniformLocation(program, "u_texture");
          gl.activeTexture(gl.TEXTURE0);
          gl.bindTexture(gl.TEXTURE_2D, textureRef.current);
          gl.uniform1i(textureLocation, 0);
        }
        gl.drawArrays(gl.TRIANGLES, 0, 6);
      } else if (weather === 'snow' || weather === 'hail') {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          let particles = particlesRef.current;
          if (weather === 'snow') {
            const targetCount = Math.floor(intensity * 8.0);
            const createSnowflake = (initial = false) => {
              const rand = Math.random();
              const layer = rand < 0.5 ? 0 : (rand < 0.85 ? 1 : 2);
              const type = Math.random() < 0.5 ? 'clump' : 'crystal';
              let size, speedY, opacity;
              if (layer === 0) {
                size = 1.0 + Math.random() * 1.5;
                speedY = 0.1 + Math.random() * 0.2;
                opacity = 0.2 + Math.random() * 0.3;
              } else if (layer === 1) {
                size = 2.5 + Math.random() * 2.5;
                speedY = 0.5 + Math.random() * 0.6;
                opacity = 0.4 + Math.random() * 0.4;
              } else {
                size = 5.0 + Math.random() * 5.0;
                speedY = 1.2 + Math.random() * 1.5;
                opacity = 0.6 + Math.random() * 0.4;
              }
              if (type === 'clump') {
                size *= 1.5;
                speedY *= 1.6;
              } else {
                speedY *= 0.6;
              }
              speedY *= (0.5 + (intensity / 100));
              return {
                x: Math.random() * canvas.width,
                y: initial ? Math.random() * canvas.height : -20 - Math.random() * 50,
                size, speedY,
                speedX: (Math.random() - 0.5) * 0.8,
                opacity, layer, type,
                angle: Math.random() * Math.PI * 2,
                spin: (Math.random() - 0.5) * 0.02
              };
            };
            while (particles.length < targetCount) {
              particles.push(createSnowflake(true));
            }
            while (particles.length > targetCount) {
              particles.pop();
            }
            particles.forEach((p, index) => {
              if (p.type === undefined) {
                particles[index] = createSnowflake(true);
                Object.assign(p, particles[index]);
              }
              if (p.sticking) {
                p.stickTime++;
                if (p.stickTime > 60) {
                  p.y += p.speedY * 0.15;
                  p.opacity -= 0.005 + Math.random() * 0.005;
                }
                if (p.opacity <= 0 || p.y > canvas.height + p.size * 2) {
                  Object.assign(p, createSnowflake(false));
                }
              } else {
                p.angle += p.spin;
                p.y += p.speedY;
                const wind = Math.sin(time / 2000 + p.y / 150) * Math.cos(time / 3000 + p.x / 200);
                p.x += p.speedX + wind * (p.layer + 1) * 0.6;
                if ((p.layer === 2 || p.layer === 1) && Math.random() < 0.0005) {
                  p.sticking = true;
                  p.stickTime = 0;
                }
                if (p.y > canvas.height + p.size * 2) {
                  Object.assign(p, createSnowflake(false));
                }
                if (p.x > canvas.width + p.size * 2) p.x = -p.size * 2;
                if (p.x < -p.size * 2) p.x = canvas.width + p.size * 2;
              }
              ctx.save();
              ctx.translate(p.x, p.y);
              ctx.rotate(p.angle);
              if (p.type === 'clump') {
                const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, p.size);
                grad.addColorStop(0, `rgba(255, 255, 255, ${p.opacity})`);
                grad.addColorStop(0.4, `rgba(255, 255, 255, ${p.opacity * 0.8})`);
                grad.addColorStop(1, `rgba(255, 255, 255, 0)`);
                ctx.fillStyle = grad;
                ctx.beginPath();
                ctx.arc(0, 0, p.size, 0, Math.PI * 2);
                ctx.arc(p.size * 0.3, p.size * 0.2, p.size * 0.7, 0, Math.PI * 2);
                ctx.arc(-p.size * 0.2, -p.size * 0.3, p.size * 0.8, 0, Math.PI * 2);
                ctx.fill();
              } else {
                ctx.shadowBlur = p.size * 1.5;
                ctx.shadowColor = `rgba(255, 255, 255, ${p.opacity})`;
                ctx.strokeStyle = `rgba(255, 255, 255, ${p.opacity * 0.7})`;
                ctx.lineWidth = p.size * 0.15;
                ctx.lineCap = 'round';
                ctx.beginPath();
                for (let i = 0; i < 6; i++) {
                  ctx.moveTo(0, 0);
                  ctx.lineTo(0, -p.size * 0.8);
                  if (p.layer === 2) {
                    ctx.moveTo(0, -p.size * 0.4);
                    ctx.lineTo(p.size * 0.3, -p.size * 0.7);
                    ctx.moveTo(0, -p.size * 0.4);
                    ctx.lineTo(-p.size * 0.3, -p.size * 0.7);
                  }
                  ctx.rotate(Math.PI / 3);
                }
                ctx.stroke();
                const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, p.size * 0.6);
                grad.addColorStop(0, `rgba(255, 255, 255, ${p.opacity})`);
                grad.addColorStop(1, `rgba(255, 255, 255, 0)`);
                ctx.fillStyle = grad;
                ctx.beginPath();
                ctx.arc(0, 0, p.size * 0.6, 0, Math.PI * 2);
                ctx.fill();
              }
              ctx.restore();
            });
          } else if (weather === 'hail') {
            const targetCount = Math.floor(intensity * 15);
            while (particles.length < targetCount) {
              particles.push({
                x: Math.random() * canvas.width,
                y: -10,
                speedY: 15 + Math.random() * 15 + (intensity / 10),
                speedX: (Math.random() - 0.5) * 3,
                size: 3 + Math.random() * 4,
              });
            }
            while (particles.length > targetCount) {
              particles.pop();
            }
            ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
            particles.forEach((p, index) => {
              if (p.layer !== undefined) {
                particles[index] = {
                  x: Math.random() * canvas.width,
                  y: -10,
                  speedY: 15 + Math.random() * 15 + (intensity / 10),
                  speedX: (Math.random() - 0.5) * 3,
                  size: 3 + Math.random() * 4,
                };
                Object.assign(p, particles[index]);
              }
              p.y += p.speedY;
              p.x += p.speedX;
              if (p.y > canvas.height) { p.y = -10; p.x = Math.random() * canvas.width; }
              if (p.x > canvas.width) p.x = 0;
              if (p.x < 0) p.x = canvas.width;
              ctx.beginPath();
              ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
              ctx.fill();
            });
          }
        }
      } else {
        const ctx = canvas.getContext('2d');
        if(ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
      animationFrameId = requestAnimationFrame(render);
    };

    render(performance.now());

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(animationFrameId);
    };
  }, [weather, intensity]);

  useEffect(() => {
    if ((weather === 'rain' || weather === 'thunderstorm') && glRef.current && bgImage) {
      textureRef.current = loadTexture(glRef.current, bgImage);
    }
  }, [bgImage, weather]);

  const contextType = (weather === 'rain' || weather === 'thunderstorm') ? 'webgl' : '2d';
  return <canvas key={contextType} ref={canvasRef} className="absolute inset-0 pointer-events-none z-10" />;
};

function Editor({ onBack, initialStory }: { onBack: () => void, initialStory?: SavedStory }) {
  const [season, setSeason] = useState(initialStory?.season || 'spring');
  const [timeOfDay, setTimeOfDay] = useState(initialStory?.timeOfDay || 'morning');
  const [weather, setWeather] = useState(initialStory?.weather || 'rain');
  const [scene, setScene] = useState(initialStory?.scene || 'bamboo');
  const [customBg, setCustomBg] = useState<string | null>(null);
  const [intensity, setIntensity] = useState(initialStory?.intensity ?? 50);
  const [subject, setSubject] = useState(initialStory?.subject || '');
  const [text, setText] = useState(initialStory?.text || '');
  const [contentImage, setContentImage] = useState<string | null>(initialStory?.image || null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const updateHeight = () => {
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
        textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
      }
    };
    updateHeight();
    window.addEventListener('resize', updateHeight);
    return () => window.removeEventListener('resize', updateHeight);
  }, [text]);

  const [isDirty, setIsDirty] = useState(false);
  const [showExitPrompt, setShowExitPrompt] = useState(false);
  const [toastMsg, setToastMsg] = useState('');
  const [fontFamily, setFontFamily] = useState(initialStory?.fontFamily || "'Microsoft YaHei', sans-serif");
  const [fontSize, setFontSize] = useState(initialStory?.fontSize ?? 18);
  const [isSettingsOpen, setIsSettingsOpen] = useState(true);
  const [isFontMenuOpen, setIsFontMenuOpen] = useState(false);
  const [isMuted, setIsMuted] = useState(false);

  useEffect(() => {
    if (scene === 'bamboo' && weather === 'thunderstorm' && timeOfDay !== 'night') {
      setTimeOfDay('night');
    }
  }, [scene, weather, timeOfDay]);

  useEffect(() => {
    audioManager.muted = isMuted;
    const activeKeys = [season, timeOfDay, weather === 'thunderstorm' ? 'rain' : weather, scene].filter(k => k !== 'none');
    if (scene === 'bamboo') {
      if (weather === 'rain') {
        activeKeys.push('bamboo_rain');
      }
      if (weather === 'thunderstorm') {
        activeKeys.push('bamboo_thunderstorm');
      } else if (timeOfDay === 'morning') {
        activeKeys.push('bamboo_morning');
      }
    }
    audioManager.play(activeKeys, intensity);

    const handleInteraction = () => {
      audioManager.unlock();
      if (!audioManager.muted) {
        audioManager.play(activeKeys, intensity);
      }
    };

    window.addEventListener('click', handleInteraction, { once: true });
    window.addEventListener('touchstart', handleInteraction, { once: true });
    window.addEventListener('keydown', handleInteraction, { once: true });

    return () => {
      window.removeEventListener('click', handleInteraction);
      window.removeEventListener('touchstart', handleInteraction);
      window.removeEventListener('keydown', handleInteraction);
    };
  }, [season, timeOfDay, weather, scene, intensity, isMuted]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setCustomBg(url);
    }
  };

  const getBgImage = () => {
    if (customBg) return customBg;
    switch (scene) {
      case 'grassland': return 'https://i.postimg.cc/R0qzXMTj/grass.png';
      case 'bamboo': return 'https://i.postimg.cc/sX4Vy4Gt/bamboo.jpg';
      case 'flowers': return 'https://images.unsplash.com/photo-1490750967868-8f7d4da51b33?auto=format&fit=crop&w=1920&q=80';
      default: return '';
    }
  };

  const getSeasonOverlay = () => {
    switch (season) {
      case 'spring': return 'bg-green-400/20 mix-blend-overlay';
      case 'summer': return 'bg-yellow-300/20 mix-blend-overlay';
      case 'autumn': return 'bg-orange-600/30 mix-blend-overlay';
      case 'winter': return 'bg-blue-300/30 mix-blend-overlay';
      default: return '';
    }
  };

  const getTimeOverlay = () => {
    switch (timeOfDay) {
      case 'morning': return 'bg-gradient-to-br from-pink-300/20 to-yellow-200/20 mix-blend-overlay';
      case 'noon': return 'bg-transparent';
      case 'sunset': return 'bg-gradient-to-br from-orange-500/40 to-purple-600/40 mix-blend-multiply';
      case 'night': return 'bg-blue-900/70 mix-blend-multiply';
      default: return '';
    }
  };

  const handleSave = async () => {
    if (!subject.trim() && !text.trim() && !contentImage) {
      setToastMsg('内容为空');
      setTimeout(() => setToastMsg(''), 2000);
      return;
    }

    const historyItem = {
      id: initialStory?.id || Date.now().toString(),
      subject: subject || '无标题',
      text: text,
      date: new Date().toLocaleString(),
      image: contentImage,
      saveTime: Date.now()
    };

    try {
      let existingHistory = [];
      try {
        const stored = localStorage.getItem('flowJourney_history');
        existingHistory = stored ? JSON.parse(stored) : [];
      } catch (e) {
        console.error('读取localStorage失败:', e);
        existingHistory = [];
      }

      const existingIndex = existingHistory.findIndex((item: any) => item.id === historyItem.id);
      if (existingIndex >= 0) {
        existingHistory[existingIndex] = historyItem;
      } else {
        existingHistory.unshift(historyItem);
      }

      try {
        localStorage.setItem('flowJourney_history', JSON.stringify(existingHistory));
        console.log('保存到localStorage成功:', existingHistory);
      } catch (e) {
        console.error('保存到localStorage失败:', e);
      }

      try {
        if (initialStory?.id) {
          await fetch(`/api/stories/${initialStory.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              subject,
              text,
              date: new Date().toLocaleString(),
              image: contentImage || undefined,
              season,
              timeOfDay,
              weather,
              scene,
              intensity,
              fontFamily,
              fontSize
            })
          });
        } else {
          await fetch('/api/stories', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              subject,
              text,
              date: new Date().toLocaleString(),
              image: contentImage || undefined,
              season,
              timeOfDay,
              weather,
              scene,
              intensity,
              fontFamily,
              fontSize
            })
          });
        }
      } catch (err) {
        console.error('网络请求失败:', err);
      }

      setIsDirty(false);
      setToastMsg('保存成功');
      setTimeout(() => setToastMsg(''), 2000);
    } catch (err) {
      console.error('保存失败:', err);
      setToastMsg('保存失败');
      setTimeout(() => setToastMsg(''), 2000);
    }
  };

  const handleBack = () => {
    if (isDirty) {
      setShowExitPrompt(true);
    } else {
      onBack();
    }
  };

  const handleContentImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setContentImage(url);
      setIsDirty(true);
    }
  };

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-black font-sans text-white">
      <div className="absolute inset-0 z-0 bg-cover bg-center transition-all duration-1000" style={{ backgroundImage: `url(${getBgImage()})` }} />
      
      <WeatherCanvas weather={weather} intensity={intensity} bgImage={getBgImage()} />
      
      <div className={`absolute inset-0 z-20 pointer-events-none transition-colors duration-1000 ${getSeasonOverlay()}`} />
      <div className={`absolute inset-0 z-20 pointer-events-none transition-colors duration-1000 ${getTimeOverlay()}`} />

      <div className="absolute top-6 left-6 z-50 flex gap-4">
        <div className="relative">
          <button onClick={() => setIsFontMenuOpen(!isFontMenuOpen)} className="bg-white/10 backdrop-blur-md border border-white/20 text-white rounded-lg p-2.5 outline-none cursor-pointer hover:bg-white/20 transition shadow-lg flex items-center justify-center" title="字体设置">
            <Type className="w-5 h-5" />
          </button>
          
          {isFontMenuOpen && (
            <div className="absolute top-full left-0 mt-2 bg-white/10 backdrop-blur-xl border border-white/20 rounded-xl shadow-2xl p-4 flex flex-col gap-4 w-48 animate-in fade-in slide-in-from-top-2">
              <div className="flex flex-col gap-2">
                <label className="text-white/80 text-sm font-medium">字体</label>
                <select value={fontFamily} onChange={e => setFontFamily(e.target.value)} className="bg-white/20 border border-white/10 text-white rounded-lg px-3 py-1.5 outline-none cursor-pointer hover:bg-white/30 transition text-sm appearance-none">
                  <option value="sans-serif" className="text-black">系统默认</option>
                  <option value="'Microsoft YaHei', sans-serif" className="text-black">微软雅黑</option>
                  <option value="'SimSun', serif" className="text-black">宋体</option>
                  <option value="'KaiTi', serif" className="text-black">楷体</option>
                </select>
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-white/80 text-sm font-medium">字号</label>
                <select value={fontSize} onChange={e => setFontSize(Number(e.target.value))} className="bg-white/20 border border-white/10 text-white rounded-lg px-3 py-1.5 outline-none cursor-pointer hover:bg-white/30 transition text-sm appearance-none">
                  <option value={14} className="text-black">14px</option>
                  <option value={16} className="text-black">16px</option>
                  <option value={18} className="text-black">18px</option>
                  <option value={20} className="text-black">20px</option>
                  <option value={24} className="text-black">24px</option>
                  <option value={28} className="text-black">28px</option>
                </select>
              </div>
            </div>
          )}
        </div>

        <button onClick={() => setIsMuted(!isMuted)} className="bg-white/10 backdrop-blur-md border border-white/20 text-white rounded-lg p-2.5 outline-none cursor-pointer hover:bg-white/20 transition shadow-lg flex items-center justify-center" title={isMuted ? "取消静音" : "静音"}>
          {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
        </button>
      </div>

      <div className="absolute bottom-6 left-6 z-50">
        <button onClick={handleBack} className="px-6 py-2 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-white text-sm font-medium tracking-widest hover:bg-white/20 hover:scale-105 transition-all duration-300 shadow-lg">
          返回
        </button>
      </div>

      <div className="absolute inset-0 z-30 flex items-center justify-center pointer-events-none p-4 sm:p-8">
        <div className="w-full max-w-3xl h-full max-h-[70vh] flex flex-col bg-white/10 backdrop-blur-xl border border-white/20 rounded-3xl shadow-2xl overflow-hidden pointer-events-auto">

          <div className="flex-1 flex flex-col p-6 sm:p-8 gap-4 overflow-hidden relative">
            <input
              type="text"
              placeholder="标题..."
              value={subject}
              onChange={e => { setSubject(e.target.value); setIsDirty(true); }}
              className="bg-transparent text-white text-2xl sm:text-3xl font-bold placeholder-white/60 outline-none shrink-0"
              style={{ fontFamily }}
            />

            <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col gap-4 pb-12 cursor-text" onClick={(e) => {
              if (e.target === e.currentTarget) {
                textareaRef.current?.focus();
              }
            }}>
              <textarea
                ref={textareaRef}
                placeholder="在这里留下你的故事..."
                value={text}
                onChange={e => { setText(e.target.value); setIsDirty(true); }}
                className="bg-transparent text-white placeholder-white/60 resize-none outline-none leading-relaxed w-full overflow-hidden shrink-0 cursor-text"
                style={{ fontFamily, fontSize: `${fontSize}px`, minHeight: '150px' }}
              />

              {contentImage && (
                <div className="relative w-fit max-w-full shrink-0">
                  <img src={contentImage} alt="Uploaded content" className="max-w-full h-auto max-h-80 object-contain bg-black/20 rounded-lg" />
                  <button onClick={() => { setContentImage(null); setIsDirty(true); }} className="absolute top-2 right-2 bg-black/50 text-white rounded-full p-1 hover:bg-black/80 transition-colors">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>

            <div className="absolute bottom-6 left-8 flex items-center gap-3">
              <label className="w-10 h-10 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-white flex items-center justify-center cursor-pointer hover:bg-white/20 hover:scale-105 transition-all duration-300 shadow-lg" title="插入图片">
                <input type="file" accept="image/jpeg, image/png, image/gif, image/jpg" className="hidden" onChange={handleContentImageUpload} />
                <Plus className="w-5 h-5" />
              </label>
            </div>

            <div className="absolute bottom-6 right-8 flex items-center gap-3">
              {toastMsg && <span className="text-white/80 text-sm animate-in fade-in">{toastMsg}</span>}
              <button onClick={handleSave} className="px-6 py-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-white text-sm font-medium tracking-widest hover:bg-white/20 hover:scale-105 transition-all duration-300 shadow-lg">
                保存
              </button>
            </div>
          </div>

          <div className="bg-black/20 backdrop-blur-md border-t border-white/10 flex flex-col">
            <button onClick={() => setIsSettingsOpen(!isSettingsOpen)} className="w-full flex items-center justify-center py-1.5 text-white/40 hover:text-white/80 hover:bg-white/5 transition-colors" title={isSettingsOpen ? "收起设置" : "展开设置"}>
              <ChevronDown className={`w-5 h-5 transition-transform duration-300 ${isSettingsOpen ? '' : 'rotate-180'}`} />
            </button>
            <div className={`transition-all duration-500 ease-in-out overflow-hidden ${isSettingsOpen ? 'max-h-[200px] opacity-100' : 'max-h-0 opacity-0'}`}>
              <div className="p-6 pt-2 overflow-x-auto custom-scrollbar">
                <div className="flex gap-10 min-w-max items-start px-2">

                  <div className="flex flex-col gap-3">
                    <span className="text-white/80 text-sm font-medium tracking-wider">场景</span>
                    <div className="flex bg-black/30 rounded-full p-1 border border-white/10 items-center">
                      {[{ id: 'bamboo', label: '竹林' }].map(sc => (
                        <button key={sc.id} onClick={() => { setScene(sc.id); setCustomBg(null); }} className={`px-5 py-1.5 rounded-full text-sm font-medium transition-all duration-300 ${scene === sc.id && !customBg ? 'bg-white/90 text-black shadow-md' : 'text-white/80 hover:text-white hover:bg-white/10'}`}>
                          {sc.label}
                        </button>
                      ))}
                      <div className="w-px h-4 bg-white/20 mx-1"></div>
                      <label className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all duration-300 cursor-pointer flex items-center justify-center ${customBg ? 'bg-white/90 text-black shadow-md' : 'text-white/80 hover:text-white hover:bg-white/10'}`}>
                        <CloudUpload className="w-4 h-4 mr-1.5" />
                        上传
                        <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                      </label>
                    </div>
                  </div>

                  <div className="flex flex-col gap-3">
                    <span className="text-white/80 text-sm font-medium tracking-wider">季节</span>
                    <div className="flex bg-black/30 rounded-full p-1 border border-white/10">
                      {[{ id: 'spring', label: '春' }, { id: 'summer', label: '夏' }, { id: 'autumn', label: '秋' }, { id: 'winter', label: '冬' }].map(s => (
                        <button key={s.id} onClick={() => setSeason(s.id)} className={`px-5 py-1.5 rounded-full text-sm font-medium transition-all duration-300 ${season === s.id ? 'bg-white/90 text-black shadow-md' : 'text-white/80 hover:text-white hover:bg-white/10'}`}>
                          {s.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex flex-col gap-3">
                    <span className="text-white/80 text-sm font-medium tracking-wider">天气</span>
                    <div className="flex bg-black/30 rounded-full p-1 border border-white/10">
                      {[{ id: 'sunny', label: '晴天' }, { id: 'rain', label: '晴雨' }, { id: 'thunderstorm', label: '雷雨' }].map(w => (
                        <button key={w.id} onClick={() => setWeather(w.id)} className={`px-5 py-1.5 rounded-full text-sm font-medium transition-all duration-300 ${weather === w.id ? 'bg-white/90 text-black shadow-md' : 'text-white/80 hover:text-white hover:bg-white/10'}`}>
                          {w.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex flex-col gap-3">
                    <span className="text-white/80 text-sm font-medium tracking-wider">时间</span>
                    <div className="flex bg-black/30 rounded-full p-1 border border-white/10">
                      {[{ id: 'morning', label: '清晨' }, { id: 'noon', label: '正午' }, { id: 'sunset', label: '夕阳' }, { id: 'night', label: '夜晚' }].map(t => (
                        <button key={t.id} onClick={() => setTimeOfDay(t.id)} className={`px-5 py-1.5 rounded-full text-sm font-medium transition-all duration-300 ${timeOfDay === t.id ? 'bg-white/90 text-black shadow-md' : 'text-white/80 hover:text-white hover:bg-white/10'}`}>
                          {t.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex flex-col gap-3 min-w-[160px]">
                    <span className="text-white/80 text-sm font-medium tracking-wider">雨滴/天气大小</span>
                    <div className="flex items-center h-[34px] px-2">
                      <input
                        type="range"
                        min="0" max="100"
                        value={intensity}
                        onChange={e => setIntensity(Number(e.target.value))}
                        className="w-full h-1.5 bg-white/20 rounded-lg appearance-none cursor-pointer accent-white"
                      />
                    </div>
                  </div>

                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {showExitPrompt && (
        <div className="absolute inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl p-8 shadow-2xl flex flex-col items-center gap-6 max-w-sm w-full mx-4">
            <p className="text-white text-lg font-medium tracking-wide text-center">您还没有保存，确定要退出吗？</p>
            <div className="flex gap-4 w-full justify-center mt-2">
              <button onClick={() => setShowExitPrompt(false)} className="px-6 py-2 rounded-full bg-white/10 border border-white/20 text-white text-sm font-medium tracking-widest hover:bg-white/20 transition-all">
                取消
              </button>
              <button onClick={onBack} className="px-6 py-2 rounded-full bg-white/20 border border-white/30 text-white text-sm font-medium tracking-widest hover:bg-white/30 transition-all">
                确定
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Home({ onStart }: { onStart: (story?: SavedStory) => void }) {
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<SavedStory[]>([]);
  const [isEditingHistory, setIsEditingHistory] = useState(false);
  const [selectedHistoryIds, setSelectedHistoryIds] = useState<string[]>([]);

  const openHistory = async () => {
    try {
      let saved = [];
      try {
        const stored = localStorage.getItem('flowJourney_history');
        if (stored) {
          saved = JSON.parse(stored);
          console.log('从localStorage读取历史记录成功:', saved);
        } else {
          console.log('localStorage中无历史记录');
        }
      } catch (e) {
        console.error('读取localStorage失败:', e);
        saved = [];
      }
      setHistory(saved);
    } catch (err) {
      console.error('读取历史记录失败:', err);
      setHistory([]);
    } finally {
      setShowHistory(true);
      setIsEditingHistory(false);
      setSelectedHistoryIds([]);
    }
  };

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-black font-sans flex items-center justify-center">
      <div className="absolute inset-0 z-0 bg-cover bg-center" style={{ backgroundImage: 'url(https://i.postimg.cc/v8PTdFGw/greeen.png)' }} />
      <div className="absolute inset-0 z-0 bg-black/20" />

      <div className="relative z-10 flex flex-col items-center gap-16 animate-in fade-in duration-1000 slide-in-from-bottom-8">
        <div className="text-center">
          <h1 className="text-[40px] drop-shadow-lg leading-tight">
            <span className="text-[#FFFFFF] font-light tracking-widest block mb-2">开始探索你的</span>
            <span className="text-[#FFFFFF] font-bold tracking-wider">Flow </span>
            <span className="text-[#0BD430] font-bold tracking-wider">Journey</span>
          </h1>
        </div>

        <div className="flex gap-6 sm:gap-10">
          <button onClick={openHistory} className="px-8 py-3.5 rounded-full bg-white/10 backdrop-blur-xl border border-white/20 text-white text-lg font-medium tracking-widest hover:bg-white/20 hover:scale-105 transition-all duration-300 shadow-[0_8px_32px_rgba(0,0,0,0.2)]">
            历史 &gt;
          </button>
          <button onClick={() => onStart()} className="px-8 py-3.5 rounded-full bg-white/20 backdrop-blur-xl border border-white/30 text-white text-lg font-medium tracking-widest hover:bg-white/30 hover:scale-105 transition-all duration-300 shadow-[0_8px_32px_rgba(0,0,0,0.2)]">
            新建 +
          </button>
        </div>
      </div>

      {showHistory && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 sm:p-8 animate-in fade-in duration-300" onClick={() => { setShowHistory(false); setIsEditingHistory(false); setSelectedHistoryIds([]); }}>
          <div className="w-full max-w-2xl max-h-[80vh] bg-white rounded-3xl shadow-2xl flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b border-gray-200 flex justify-between items-center">
              <h2 className="text-2xl font-bold text-gray-900 tracking-widest">历史记录</h2>
              <div className="flex items-center gap-4">
                {!isEditingHistory && history.length > 0 && (
                  <button onClick={() => setIsEditingHistory(true)} className="text-gray-600 hover:text-gray-900 text-sm tracking-widest">编辑</button>
                )}
                <button onClick={() => { setShowHistory(false); setIsEditingHistory(false); setSelectedHistoryIds([]); }} className="text-gray-400 hover:text-gray-600 text-3xl leading-none">&times;</button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-4 custom-scrollbar">
              {history.length === 0 ? (
                <div className="text-center text-gray-500 py-10 tracking-widest">暂无保存的文章</div>
              ) : (
                history.map(story => (
                  <div key={story.id} className="bg-gray-50 rounded-2xl p-5 border border-gray-200 hover:bg-gray-100 transition-colors relative cursor-pointer h-[160px] flex flex-col overflow-hidden" onClick={() => {
                    if (!isEditingHistory) {
                      onStart(story);
                    }
                  }}>
                    <div className="flex justify-between items-start mb-3 shrink-0">
                      <h3 className="text-xl font-bold text-gray-900 truncate pr-4">{story.subject || '无标题'}</h3>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className="text-sm text-gray-400">{story.date}</span>
                        {isEditingHistory && (
                          <button onClick={(e) => {
                            e.stopPropagation();
                            setSelectedHistoryIds(prev => prev.includes(story.id) ? prev.filter(id => id !== story.id) : [...prev, story.id]);
                          }} className={`w-6 h-6 rounded-full border flex items-center justify-center transition-colors ${selectedHistoryIds.includes(story.id) ? 'bg-[#0BD430] border-[#0BD430] text-white' : 'border-gray-300 text-transparent hover:border-gray-500'}`}>
                            √
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="flex-1 overflow-hidden flex gap-4">
                      <p className="flex-1 text-base text-gray-700 whitespace-pre-wrap leading-relaxed line-clamp-3">{story.text}</p>
                      {story.image && (
                        <div className="w-16 h-16 shrink-0 rounded-lg overflow-hidden">
                          <img src={story.image} alt="Story content" className="w-full h-full object-cover bg-gray-100" />
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
            {isEditingHistory && (
              <div className="p-4 border-t border-gray-200 flex justify-end gap-4 bg-gray-50">
                <button onClick={() => { setIsEditingHistory(false); setSelectedHistoryIds([]); }} className="px-6 py-2 rounded-full bg-gray-100 border border-gray-300 text-gray-700 text-sm font-medium tracking-widest hover:bg-gray-200 transition-all">
                  取消
                </button>
                {selectedHistoryIds.length > 0 && (
                  <button onClick={async () => {
                    try {
                      const existingHistory = JSON.parse(localStorage.getItem('flowJourney_history') || '[]');
                      const newHistory = existingHistory.filter((h: any) => !selectedHistoryIds.includes(h.id));
                      localStorage.setItem('flowJourney_history', JSON.stringify(newHistory));

                      try {
                        await Promise.all(selectedHistoryIds.map(id => fetch(`/api/stories/${id}`, { method: 'DELETE' })));
                      } catch (err) {
                        console.error('网络删除失败:', err);
                      }

                      setHistory(newHistory);
                      setSelectedHistoryIds([]);
                      if (newHistory.length === 0) {
                        setIsEditingHistory(false);
                      }
                    } catch (err) {
                      console.error(err);
                    }
                  }} className="px-6 py-2 rounded-full bg-red-500/80 border border-red-500 text-white text-sm font-medium tracking-widest hover:bg-red-500 transition-all">
                    删除
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function App() {
  const [view, setView] = useState<'home' | 'editor'>('home');
  const [currentStory, setCurrentStory] = useState<SavedStory | undefined>(undefined);

  return (
    <>
      {view === 'home' ? (
        <Home onStart={(story) => {
          setCurrentStory(story);
          setView('editor');
        }} />
      ) : (
        <Editor onBack={() => {
          setView('home');
          setCurrentStory(undefined);
        }} initialStory={currentStory} />
      )}
    </>
  );
}