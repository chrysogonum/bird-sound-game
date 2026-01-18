import { useRef, useEffect, useState, useImperativeHandle, forwardRef } from 'react';

interface ShareCardProps {
  score: number;
  accuracy: number;
  eventsScored: number;
  totalEvents: number;
  maxStreak: number;
  species: Array<{ code: string; name: string }>;
  packId?: string;
  levelId?: number;
  levelTitle?: string;
  topConfusion?: { from: string; to: string } | null;
  usedTrainingMode?: boolean;
}

export interface ShareCardHandle {
  share: () => Promise<string | void>;
  download: () => void;
  isReady: () => boolean;
}

const ShareCard = forwardRef<ShareCardHandle, ShareCardProps>(({
  score,
  accuracy,
  eventsScored,
  totalEvents,
  maxStreak,
  species,
  packId,
  levelId,
  levelTitle: _levelTitle,
  topConfusion,
  usedTrainingMode
}, ref) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [birdIconsLoaded, setBirdIconsLoaded] = useState(false);
  const loadedIconsRef = useRef<Map<string, HTMLImageElement>>(new Map());
  const [canvasReady, setCanvasReady] = useState(false);
  const [owlIconLoaded, setOwlIconLoaded] = useState(false);
  const owlIconRef = useRef<HTMLImageElement | null>(null);

  // Load bird icons
  useEffect(() => {
    const loadIcons = async () => {
      const baseUrl = import.meta.env.BASE_URL;
      const promises = species.map(s => {
        return new Promise<{ code: string; img: HTMLImageElement }>((resolve, reject) => {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.onload = () => resolve({ code: s.code, img });
          img.onerror = reject;
          img.src = `${baseUrl}data/icons/${s.code}.png`;
        });
      });

      try {
        const results = await Promise.all(promises);
        // Store loaded images in ref
        results.forEach(({ code, img }) => {
          loadedIconsRef.current.set(code, img);
        });
        setBirdIconsLoaded(true);
      } catch (err) {
        console.error('Failed to load bird icons:', err);
        setBirdIconsLoaded(true); // Continue anyway
      }
    };

    loadIcons();
  }, [species]);

  // Load owl icon for background
  useEffect(() => {
    const loadOwl = async () => {
      const baseUrl = import.meta.env.BASE_URL;
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        owlIconRef.current = img;
        setOwlIconLoaded(true);
      };
      img.onerror = () => {
        console.error('Failed to load owl icon');
        setOwlIconLoaded(true); // Continue anyway
      };
      img.src = `${baseUrl}data/icons/OwlHeadphones.png`;
    };

    loadOwl();
  }, []);

  // Render canvas when icons are loaded
  useEffect(() => {
    if (!birdIconsLoaded || !owlIconLoaded || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size (Square for versatility - 800x800)
    const width = 800;
    const height = 800;
    canvas.width = width;
    canvas.height = height;

    // Better background with more contrast
    const bgGradient = ctx.createLinearGradient(0, 0, 0, height);
    bgGradient.addColorStop(0, '#f0f4f8');
    bgGradient.addColorStop(1, '#d9e2ec');
    ctx.fillStyle = bgGradient;
    ctx.fillRect(0, 0, width, height);

    // Draw owl icon as transparent watermark if available
    if (owlIconRef.current) {
      ctx.save();
      ctx.globalAlpha = 1.0; // Full opacity watermark
      const owlSize = 280;
      const owlX = width - owlSize - 20; // Upper right corner with 20px margin
      const owlY = 20; // 20px from top
      ctx.drawImage(owlIconRef.current, owlX, owlY, owlSize, owlSize);
      ctx.restore();
    }

    // Title with emoji and exclamation point
    ctx.fillStyle = '#102a43';
    ctx.font = 'bold 48px -apple-system, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('ChipNotes! 🎧🐦', width / 2, 80);

    // Score and accuracy on same line - LEFT ALIGNED
    ctx.textAlign = 'left';
    const leftMargin = 60;

    ctx.font = 'bold 110px -apple-system, system-ui, sans-serif';
    ctx.fillStyle = accuracy >= 80 ? '#6aaa64' : accuracy >= 60 ? '#c9b458' : '#787c7e';
    ctx.fillText(`${accuracy}%`, leftMargin, 200);

    // Score below
    ctx.font = 'bold 36px -apple-system, system-ui, sans-serif';
    ctx.fillStyle = '#334e68';
    ctx.fillText(`${score} points`, leftMargin, 245);

    // Birds identified
    ctx.font = '24px -apple-system, system-ui, sans-serif';
    ctx.fillStyle = '#486581';
    ctx.fillText(`${eventsScored}/${totalEvents} birds identified`, leftMargin, 280);

    // Reset text alignment to center for the rest
    ctx.textAlign = 'center';

    // Bird icons in horizontal row - MASSIVE icons!
    const maxBirds = 4; // Limit to 4 for single row
    const iconsToShow = species.slice(0, maxBirds);
    const iconSize = 160; // MASSIVE icons!
    const gridSpacing = 24;

    const totalWidth = iconsToShow.length * iconSize + (iconsToShow.length - 1) * gridSpacing;
    const gridStartX = (width - totalWidth) / 2;
    let currentY = 320;

    iconsToShow.forEach((s, i) => {
      const x = gridStartX + i * (iconSize + gridSpacing);
      const y = currentY;

      // Use pre-loaded bird icon
      const img = loadedIconsRef.current.get(s.code);
      if (img) {
        // Draw light gray border
        ctx.strokeStyle = '#d3d6da';
        ctx.lineWidth = 2;
        ctx.strokeRect(x, y, iconSize, iconSize);

        // Draw icon
        ctx.drawImage(img, x, y, iconSize, iconSize);

        // Draw species code below (BIGGER font for 160px icons)
        ctx.font = 'bold 26px monospace';
        ctx.fillStyle = '#102a43';
        ctx.fillText(s.code, x + iconSize / 2, y + iconSize + 38);
      }
    });

    // Stats section (below bird icons - single row now)
    const statsY = currentY + iconSize + 80;

    // Additional stats (centered)

    // Streak
    ctx.font = 'bold 28px -apple-system, system-ui, sans-serif';
    ctx.fillStyle = '#334e68';
    ctx.fillText(`🔥 Best Streak: ${maxStreak}`, width / 2, statsY);

    // Pack and Level
    if (packId && levelId) {
      const packName = getPackDisplayName(packId);
      ctx.font = '24px -apple-system, system-ui, sans-serif';
      ctx.fillStyle = '#486581';
      ctx.fillText(`${packName} • Level ${levelId}`, width / 2, statsY + 40);
    }

    // Bird list (all species codes)
    const allBirdCodes = species.map(s => s.code).join(' • ');
    ctx.font = '18px monospace';
    ctx.fillStyle = '#627d98';

    // Word wrap if too long
    const maxWidth = 700;
    const words = allBirdCodes.split(' ');
    let line = '';
    let yPos = statsY + 80;

    for (let i = 0; i < words.length; i++) {
      const testLine = line + words[i] + ' ';
      const metrics = ctx.measureText(testLine);
      if (metrics.width > maxWidth && i > 0) {
        ctx.fillText(line.trim(), width / 2, yPos);
        line = words[i] + ' ';
        yPos += 25;
      } else {
        line = testLine;
      }
    }
    ctx.fillText(line.trim(), width / 2, yPos);

    // Training mode indicator (if used)
    if (usedTrainingMode) {
      const trainingY = yPos + 35;
      ctx.font = 'bold 20px -apple-system, system-ui, sans-serif';
      ctx.fillStyle = '#c9b458'; // Yellow/warning color
      ctx.fillText('🎓 Training Mode Used', width / 2, trainingY);

      ctx.font = '17px -apple-system, system-ui, sans-serif';
      ctx.fillStyle = '#627d98';
      ctx.fillText('Ready to take off the training wheels?', width / 2, trainingY + 28);
    }

    // Footer
    ctx.font = 'bold 28px -apple-system, system-ui, sans-serif';
    ctx.fillStyle = '#102a43';
    ctx.textAlign = 'center';
    ctx.fillText('chipnotes.app', width / 2, height - 60);

    ctx.font = '22px -apple-system, system-ui, sans-serif';
    ctx.fillStyle = '#486581';
    ctx.fillText('#chipnotes #birdnerd', width / 2, height - 30);

    // Force a synchronous flush by reading a pixel (ensures all drawing is complete)
    ctx.getImageData(0, 0, 1, 1);

    // Use double requestAnimationFrame to ensure canvas is fully painted
    // First RAF fires before paint, second RAF fires after paint
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        // NOW the canvas is actually painted to the bitmap
        setCanvasReady(true);
      });
    });

  }, [birdIconsLoaded, owlIconLoaded, score, accuracy, eventsScored, totalEvents, maxStreak, species, packId, levelId, topConfusion, usedTrainingMode]);

  const handleDownload = () => {
    if (!canvasRef.current) return;

    const link = document.createElement('a');
    link.download = `chipnotes-${accuracy}pct-${Date.now()}.png`;
    link.href = canvasRef.current.toDataURL('image/png');
    link.click();
  };

  const handleShare = async (): Promise<string | void> => {
    if (!canvasRef.current || !canvasReady) {
      throw new Error('Canvas not ready');
    }

    // Check if we're on iOS
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;

    try {
      if (isIOS) {
        // iOS: Open image in new tab for manual save
        const dataUrl = canvasRef.current.toDataURL('image/png');

        // Open in new tab
        const newTab = window.open();
        if (newTab) {
          newTab.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
              <title>ChipNotes Score</title>
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <style>
                body {
                  margin: 0;
                  padding: 20px;
                  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
                  background: #1a1a1a;
                  color: white;
                  display: flex;
                  flex-direction: column;
                  align-items: center;
                  min-height: 100vh;
                }
                img {
                  max-width: 100%;
                  height: auto;
                  border-radius: 12px;
                  box-shadow: 0 10px 40px rgba(0,0,0,0.5);
                }
                .instructions {
                  margin-top: 20px;
                  padding: 16px;
                  background: rgba(255,255,255,0.1);
                  border-radius: 8px;
                  text-align: center;
                  max-width: 90%;
                }
                .instructions h2 {
                  margin: 0 0 12px 0;
                  font-size: 20px;
                }
                .instructions p {
                  margin: 8px 0;
                  font-size: 16px;
                  opacity: 0.9;
                }
                .highlight {
                  color: #FFD54F;
                  font-weight: 600;
                }
                .close-btn {
                  position: fixed;
                  top: 20px;
                  left: 20px;
                  width: 48px;
                  height: 48px;
                  border-radius: 50%;
                  background: rgba(255,255,255,0.9);
                  border: 2px solid rgba(0,0,0,0.1);
                  color: #1a1a1a;
                  font-size: 28px;
                  font-weight: bold;
                  cursor: pointer;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  transition: all 0.3s;
                  box-shadow: 0 4px 12px rgba(0,0,0,0.3);
                  z-index: 1000;
                }
                .close-btn:hover {
                  background: white;
                  transform: scale(1.1);
                  box-shadow: 0 6px 16px rgba(0,0,0,0.4);
                }
              </style>
            </head>
            <body>
              <button class="close-btn" onclick="window.close(); setTimeout(function() { window.history.back(); }, 100);">✕</button>
              <img src="${dataUrl}" alt="ChipNotes Score">
              <div class="instructions">
                <p><span class="highlight">Press and hold to share or save</span></p>
              </div>
            </body>
            </html>
          `);
          newTab.document.close();
        }

        // Return a flag indicating iOS save instructions shown
        return 'ios-instructions';

      } else {
        // Non-iOS: Use normal file sharing
        const blob = await new Promise<Blob>((resolve, reject) => {
          canvasRef.current!.toBlob((b) => {
            if (b) {
              resolve(b);
            } else {
              reject(new Error('toBlob failed'));
            }
          }, 'image/png', 1.0);
        });

        const file = new File([blob], 'chipnotes-score.png', { type: 'image/png' });

        if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({
            title: 'ChipNotes! Score',
            text: `Just identified ${eventsScored}/${totalEvents} birds with ${accuracy}% accuracy! 🎧🐦`,
            files: [file],
          });
          return 'shared';
        } else {
          // Fallback to download
          handleDownload();
          return 'downloaded';
        }
      }
    } catch (err) {
      console.error('Share failed:', err);
      // Fallback to download on any error
      handleDownload();
      return 'error-downloaded';
    }
  };

  // Expose share and download methods via ref
  useImperativeHandle(ref, () => ({
    share: handleShare,
    download: handleDownload,
    isReady: () => canvasReady,
  }), [canvasReady]);

  return (
    // Completely hidden canvas - never visible
    <div style={{ position: 'absolute', left: '-9999px', top: '-9999px' }}>
      <canvas ref={canvasRef} />
    </div>
  );
});

ShareCard.displayName = 'ShareCard';

function getPackDisplayName(packId: string): string {
  const packNames: Record<string, string> = {
    'starter_birds': 'Common Backyard',
    'expanded_backyard': 'Expanded Backyard',
    'sparrows': 'Sparrows',
    'woodpeckers': 'Woodpeckers',
    'spring_warblers': 'Warbler Academy',
    'western_birds': 'Western Backyard',
  };
  return packNames[packId] || packId;
}

export default ShareCard;
