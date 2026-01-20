import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useState, useEffect, useRef } from 'react';

function Help() {
  const navigate = useNavigate();
  const location = useLocation();

  // Track which sections are expanded (some start open by default)
  // If navigated from version number, auto-open Version History
  // If navigated with #training-mode hash, auto-open Training Mode
  const initialSections = ['Why Learn Bird Song?', 'The Basics', 'Scoring'];
  if (location.state?.openVersionHistory) {
    initialSections.push('Version History');
  }
  if (location.hash === '#training-mode') {
    initialSections.push('Training Mode');
  }
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(initialSections)
  );

  // Track if user has scrolled
  const [hasScrolled, setHasScrolled] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const versionHistoryRef = useRef<HTMLDivElement>(null);
  const hasScrolledToHashRef = useRef(false);


  const allSections = [
    'Why Learn Bird Song?',
    'The Basics',
    'Scoring',
    'The Packs',
    'The Levels',
    'Tips',
    'Training Mode',
    'Taxonomic Sorting',
    'The 4-Letter Codes',
    'The Spectrograms',
    'About & Credits',
    'Support This Project',
    'Feedback & Bug Reports',
    'Version History'
  ];

  const toggleSection = (title: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(title)) {
      newExpanded.delete(title);
    } else {
      newExpanded.add(title);
    }
    setExpandedSections(newExpanded);
  };

  const toggleAll = () => {
    if (expandedSections.size === allSections.length) {
      // All expanded, collapse all
      setExpandedSections(new Set());
    } else {
      // Some or none expanded, expand all
      setExpandedSections(new Set(allSections));
    }
  };

  const allExpanded = expandedSections.size === allSections.length;

  // Show button once user scrolls
  useEffect(() => {
    const handleScroll = () => {
      if (!hasScrolled && containerRef.current && containerRef.current.scrollTop > 0) {
        setHasScrolled(true);
      }
    };

    const container = containerRef.current;
    if (container) {
      container.addEventListener('scroll', handleScroll);
      return () => container.removeEventListener('scroll', handleScroll);
    }
  }, [hasScrolled]);

  // Auto-scroll to Version History if navigated from version number
  useEffect(() => {
    if (location.state?.openVersionHistory && versionHistoryRef.current) {
      setTimeout(() => {
        versionHistoryRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100); // Small delay to ensure section is rendered expanded
    }
  }, [location.state]);

  // Auto-scroll to training-mode section if hash is present (only once on mount)
  useEffect(() => {
    if (location.hash === '#training-mode' && !hasScrolledToHashRef.current) {
      hasScrolledToHashRef.current = true;
      setTimeout(() => {
        const element = document.getElementById('training-mode');
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 100); // Small delay to ensure section is rendered expanded
    }
  }, [location.hash]);

  const scrollToTop = () => {
    containerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div ref={containerRef} className="screen" style={{ paddingBottom: '32px', position: 'relative' }}>
        <div className="flex-row items-center gap-md" style={{ marginBottom: '24px' }}>
          <button
            className="btn-icon"
            onClick={() => location.state?.fromPackSelect ? navigate('/pack-select') : navigate(-1)}
            aria-label="Back"
          >
            <BackIcon />
          </button>
          <h2 style={{ margin: 0 }}>How to Play</h2>
        </div>

      <div style={{ maxWidth: '600px', margin: '0 auto' }}>
        {/* Why Learn Bird Song */}
        <Section
          title="Why Learn Bird Song?"
          isExpanded={expandedSections.has('Why Learn Bird Song?')}
          onToggle={() => toggleSection('Why Learn Bird Song?')}
        >
          <p style={{ marginBottom: '12px' }}>
            Birds are <em>heard</em> way more often than they're <em>seen</em>. Once you know the songs, you'll know what to look for - and suddenly your backyard becomes way more interesting.
          </p>
          <p style={{ marginBottom: '12px' }}>
            <strong>Why the left/right thing?</strong> It feels like a hearing test because that's birding! In the field, you're constantly triangulating: "Cardinal to my left, chickadee to my right, warbler... somewhere up there?" This game mimics that chaos. Plus, training your ears to separate simultaneous sounds - like a pianist controlling both hands independently - dramatically sharpens your birding skills.
          </p>
          <p style={{ fontSize: '14px', color: 'var(--color-text-muted)' }}>
            <strong>Need real-time ID?</strong> Get Cornell's free <a href="https://merlin.allaboutbirds.org/" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-accent)' }}>Merlin app</a> - it's magic for "what bird is that singing <em>right now</em>?"
          </p>
        </Section>

        {/* The Basics */}
        <Section
          title="The Basics"
          isExpanded={expandedSections.has('The Basics')}
          onToggle={() => toggleSection('The Basics')}
        >
          <p style={{ marginBottom: '12px' }}>
            <strong>Listen. Identify. Tap.</strong>
          </p>
          <p style={{ marginBottom: '12px' }}>
            Bird sounds play through your left or right ear. Identify which bird is singing
            and tap its circle on the correct side before the tile passes the scoring zone.
          </p>
          <p style={{ marginBottom: '12px' }}>
            Each round is 30 seconds. Use headphones for the best experience - unless you want everyone to know you're a bird nerd!
          </p>
          <p style={{ fontSize: '14px', color: 'var(--color-text-muted)' }}>
            <strong>Mobile tip:</strong> For fullscreen play on iOS, use Safari. On Android Chrome, tap ⋮ → "Add to Home screen" and launch from the icon.
          </p>
        </Section>

        {/* Scoring */}
        <Section
          title="Scoring"
          isExpanded={expandedSections.has('Scoring')}
          onToggle={() => toggleSection('Scoring')}
        >
          <ScoreRow label="Perfect" points={100} description="Right bird + right ear + great timing" color="var(--color-success)" />
          <ScoreRow label="Good" points={75} description="Right bird + right ear" color="var(--color-success)" />
          <ScoreRow label="Partial" points={25} description="Right bird, wrong ear" color="var(--color-accent)" />
          <ScoreRow label="Miss" points={0} description="Wrong bird or no response" color="var(--color-error)" />
        </Section>

        {/* The Packs */}
        <Section
          title="The Packs"
          isExpanded={expandedSections.has('The Packs')}
          onToggle={() => toggleSection('The Packs')}
        >
          <PackInfo
            name="Eastern Backyard Birds"
            description="Perfect for beginners. Six distinctive birds you'll hear in your own backyard: American Crow (AMCR), American Robin (AMRO), Blue Jay (BLJA), Carolina Wren (CARW), Northern Cardinal (NOCA), and Tufted Titmouse (TUTI)."
          />
          <PackInfo
            name="Expanded Eastern US Birds"
            description="39 species from the eastern US. Nine birds are selected randomly, and you can shuffle for a new set anytime from the preview screen."
          />
          <PackInfo
            name="Sparrows"
            description="Master the subtle singers! Eight sparrow species with distinctive patterns: White-throated, Song, Chipping, Swamp, Savannah, Field, Lincoln's, and White-crowned."
          />
          <PackInfo
            name="Woodpeckers"
            description="Drums, rattles, and calls. Learn seven species: Downy, Hairy, Red-bellied, Pileated, Yellow-bellied Sapsucker, Northern Flicker, and Red-headed."
          />
          <PackInfo
            name="Western Backyard Birds"
            description="14 common backyard species from western North America: Steller's Jay, Western Scrub-Jay, Black-capped Chickadee, White-crowned Sparrow, Cassin's Finch, Pine Siskin, Evening Grosbeak, and more."
          />
          <PackInfo
            name="Warbler Academy"
            description="For experts! 33 wood-warbler species with their high-pitched, buzzy songs. Nine warblers are selected randomly - shuffle for a new set anytime."
          />
        </Section>

        {/* The Levels */}
        <Section
          title="The Levels"
          isExpanded={expandedSections.has('The Levels')}
          onToggle={() => toggleSection('The Levels')}
        >
          <p style={{ marginBottom: '12px', color: 'var(--color-text-muted)', fontSize: '14px' }}>
            Each pack has 6 levels that build your skills:
          </p>
          <LevelInfo level={1} title="Meet the Birds" description="One clear recording per bird, single ear. Learn each signature voice." />
          <LevelInfo level={2} title="Sound Variations" description="Up to 3 recordings per bird. Same species, different songs." />
          <LevelInfo level={3} title="Full Repertoire" description="All recordings in play. Master every variation." />
          <LevelInfo level={4} title="Both Ears" description="Sounds from either side. Identify the bird AND the direction." />
          <LevelInfo level={5} title="Variations + Both Ears" description="Multiple recordings, either ear. Getting challenging!" />
          <LevelInfo level={6} title="Master Birder" description="Everything at once. You're a pro now." />
        </Section>

        {/* Tips */}
        <Section
          title="Tips"
          isExpanded={expandedSections.has('Tips')}
          onToggle={() => toggleSection('Tips')}
        >
          <Tip>Start with the 6 common birds, even if you're eager for more.</Tip>
          <Tip>
            Use{' '}
            <Link to="/pack-select#bird-reference" state={{ fromHelp: true }} style={{ color: 'var(--color-accent)', textDecoration: 'underline' }}>
              Bird Reference
            </Link>
            {' '}to preview all sounds included in the game.
          </Tip>
          <Tip>Your birds stay the same between rounds. Hit the shuffle button on the preview screen for a fresh set.</Tip>
          <Tip>Don't rush. Let the sound register before you tap.</Tip>
          <Tip>Check the round summary and confusion matrix to see which birds need practice.</Tip>
          <Tip>Adjust tile speed in Settings if things move too fast (or too slow). Once you're an expert, try playing muted using only spectrograms!</Tip>
        </Section>

        {/* Training Mode */}
        <Section
          id="training-mode"
          title="Training Mode"
          isExpanded={expandedSections.has('Training Mode')}
          onToggle={() => toggleSection('Training Mode')}
        >
          <p>
            Toggle the <strong>eye icon</strong> (next to the back button) during gameplay to enable Training Mode.
          </p>
          <p>
            When active, each tile shows its bird icon and species code alongside the spectrogram.
            Use this to learn which spectrograms belong to which birds, then toggle off to challenge yourself!
          </p>
          <div style={{
            background: 'var(--color-surface)',
            padding: '12px',
            borderRadius: '8px',
            marginTop: '12px',
            fontSize: '14px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
          }}>
            <span style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '32px',
              height: '32px',
              background: 'rgba(76, 175, 80, 0.3)',
              border: '2px solid rgba(76, 175, 80, 0.6)',
              borderRadius: '50%',
              color: '#81C784',
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            </span>
            <span style={{ color: 'var(--color-text-muted)' }}>Eye icon glows green when Training Mode is ON</span>
          </div>
        </Section>

        {/* Taxonomic Sorting */}
        <Section
          title="Taxonomic Sorting"
          isExpanded={expandedSections.has('Taxonomic Sorting')}
          onToggle={() => toggleSection('Taxonomic Sorting')}
        >
          <p>
            Toggle taxonomic sorting on the preview screen to see birds in phylogenetic order with scientific names - perfect for learning evolutionary relationships! 🐦🤓
          </p>
          <p style={{ marginTop: '12px' }}>
            When enabled, birds are sorted by their position on the evolutionary tree (using the 2025 eBird/AOS taxonomy) instead of alphabetically. Common names are replaced with <em>scientific names in italics</em>.
          </p>
          <p style={{ marginTop: '12px' }}>
            This sorting also applies to the species buttons during gameplay, helping you build taxonomic muscle memory as you learn.
          </p>
          <div style={{
            background: 'var(--color-surface)',
            padding: '12px',
            borderRadius: '8px',
            marginTop: '12px',
            fontSize: '14px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
          }}>
            <span style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '32px',
              height: '32px',
              background: 'rgba(100, 181, 246, 0.3)',
              border: '2px solid rgba(100, 181, 246, 0.6)',
              borderRadius: '50%',
              color: '#64B5F6',
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="7" height="7" />
                <rect x="14" y="3" width="7" height="7" />
                <rect x="14" y="14" width="7" height="7" />
                <rect x="3" y="14" width="7" height="7" />
              </svg>
            </span>
            <span style={{ color: 'var(--color-text-muted)' }}>Toggle glows blue when Taxonomic Sorting is ON</span>
          </div>
        </Section>

        {/* Bird Codes */}
        <Section
          title="The 4-Letter Codes"
          isExpanded={expandedSections.has('The 4-Letter Codes')}
          onToggle={() => toggleSection('The 4-Letter Codes')}
        >
          <p>
            Birders use standardized 4-letter codes (called "Alpha codes") as shorthand for species names.
            They're easy to learn:
          </p>
          <div style={{
            background: 'var(--color-surface)',
            padding: '12px',
            borderRadius: '8px',
            marginTop: '8px',
            fontSize: '14px',
            lineHeight: 1.6
          }}>
            <div><strong>Two-word names:</strong> First 2 letters of each word</div>
            <div style={{ color: 'var(--color-text-muted)', marginLeft: '12px' }}>
              Northern Cardinal → NO + CA → NOCA
            </div>
            <div style={{ marginTop: '8px' }}><strong>Three-word names:</strong> 1 + 1 + 2 letters</div>
            <div style={{ color: 'var(--color-text-muted)', marginLeft: '12px' }}>
              Red-bellied Woodpecker → R + B + WO → RBWO
            </div>
            <div style={{ marginTop: '12px', fontStyle: 'italic', color: 'var(--color-text-muted)' }}>
              There <a href="https://www.birdpop.org/pages/birdSpeciesCodes.php" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-accent)', textDecoration: 'underline' }}>are exceptions</a>. Because, ornithology.
            </div>
          </div>
        </Section>

        {/* Spectrograms */}
        <Section
          title="The Spectrograms"
          isExpanded={expandedSections.has('The Spectrograms')}
          onToggle={() => toggleSection('The Spectrograms')}
        >
          <p>
            The colorful images on tiles are spectrograms - visual pictures of sound.
            Time flows left to right, pitch goes bottom to top, and brightness shows volume.
          </p>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '14px' }}>
            With practice, you'll recognize birds by their visual patterns too!
          </p>
        </Section>

        {/* About & Credits */}
        <Section
          title="About & Credits"
          isExpanded={expandedSections.has('About & Credits')}
          onToggle={() => toggleSection('About & Credits')}
        >
          <div style={{ textAlign: 'center', marginBottom: '16px' }}>
            <div style={{ fontSize: '32px', marginBottom: '8px' }}>🎧 🐦 🎵 ❤️</div>
            <div style={{ fontSize: '16px', fontWeight: 600, color: 'var(--color-text)', marginBottom: '4px' }}>
              Created by Peter Repetti
            </div>
            <div style={{ fontSize: '14px', color: 'var(--color-text-muted)', lineHeight: 1.6 }}>
              Made with love by bird nerds, for bird nerds
            </div>
          </div>

          <div style={{ fontSize: '14px', color: 'var(--color-text-muted)', lineHeight: 1.6 }}>
            <p style={{ marginBottom: '12px' }}>
              <strong style={{ color: 'var(--color-accent)' }}>Bird sounds:</strong> Sourced from{' '}
              <a href="https://xeno-canto.org" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-accent)', textDecoration: 'underline' }}>
                Xeno-Canto
              </a>
              , the{' '}
              <a href="https://www.macaulaylibrary.org" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-accent)', textDecoration: 'underline' }}>
                Cornell Macaulay Library
              </a>
              {' '}and from user contributions. All sound clips have attribution with XC catalog numbers and recordist names in the Bird Reference (expand any species on the{' '}
              <Link to="/pack-select#bird-reference" state={{ fromHelp: true }} style={{ color: 'var(--color-accent)', textDecoration: 'underline' }}>
                Pack Select
              </Link>
              {' '}screen).
            </p>

            <p style={{ marginBottom: '12px' }}>
              <strong style={{ color: 'var(--color-accent)' }}>The Tech:</strong> Built by Claude Code with TypeScript, React, and PixiJS for buttery-smooth scrolling spectrograms. The Web Audio API handles sample-accurate playback with real-time stereo panning - your browser decodes and buffers audio into memory for zero-latency triggering. Vite bundles it all into a PWA (Progressive Web App) that caches sounds as you play them - so load up those birds before your flight to New Zealand takes off ✈️.
            </p>

            <p style={{ marginBottom: '12px' }}>
              <strong style={{ color: 'var(--color-accent)' }}>Special thanks:</strong> To the global birding community for sharing these recordings.
            </p>

            <p style={{ marginTop: '16px', fontSize: '13px', fontStyle: 'italic' }}>
              Good birding! 🐦
            </p>
          </div>
        </Section>

        {/* Support This Project */}
        <Section
          title="Support This Project"
          isExpanded={expandedSections.has('Support This Project')}
          onToggle={() => toggleSection('Support This Project')}
        >
          <p style={{ color: 'var(--color-text-muted)', lineHeight: 1.6, marginBottom: '16px' }}>
            ChipNotes is free, ad-free, and built as a passion project. If it's helped you level up your birding skills, consider{' '}
            <a href="https://ko-fi.com/chipnotes" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-accent)', textDecoration: 'underline' }}>
              supporting development
            </a>
            {' '}- your donations help me add new species packs, build new features, keep my coffee fund stocked - and allow me to go birding. Now, you go build something cool - it might be easier than you think! ;)
          </p>

          <p style={{ color: 'var(--color-text-muted)', lineHeight: 1.6, marginBottom: '8px', fontWeight: 600 }}>
            Please also consider supporting the organizations that make this possible:
          </p>
          <ul style={{ margin: 0, paddingLeft: '20px', color: 'var(--color-text-muted)', lineHeight: 1.8 }}>
            <li>
              <a href="https://www.birds.cornell.edu/home/support/" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-accent)', textDecoration: 'underline' }}>
                Cornell Macaulay Library
              </a>
              {' '}- Incredible bird sound archive
            </li>
            <li>
              <a href="https://xeno-canto.org/about/donate" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-accent)', textDecoration: 'underline' }}>
                Xeno-Canto
              </a>
              {' '}- Community-driven bird recording database
            </li>
          </ul>

          <p style={{ marginTop: '16px', fontSize: '14px', fontStyle: 'italic', color: 'var(--color-text-muted)' }}>
            Thank you for learning with me! 🐦
          </p>
        </Section>

        {/* Feedback & Contact */}
        <Section
          title="Feedback & Bug Reports"
          isExpanded={expandedSections.has('Feedback & Bug Reports')}
          onToggle={() => toggleSection('Feedback & Bug Reports')}
        >
          <p style={{ color: 'var(--color-text-muted)', lineHeight: 1.6, marginBottom: '16px' }}>
            I'd love to hear from you! Found a bug? Have a feature suggestion? Want to share your experience?
          </p>
          <div style={{
            background: 'var(--color-surface)',
            padding: '16px',
            borderRadius: '12px',
            marginBottom: '12px'
          }}>
            <div style={{ fontSize: '14px', fontWeight: 600, marginBottom: '8px', color: 'var(--color-accent)' }}>
              📧 Email
            </div>
            <a
              href="mailto:feedback@chipnotes.app"
              style={{
                color: 'var(--color-text)',
                textDecoration: 'none',
                fontSize: '14px',
              }}
            >
              feedback@chipnotes.app
            </a>
          </div>
          <div style={{
            background: 'var(--color-surface)',
            padding: '16px',
            borderRadius: '12px'
          }}>
            <div style={{ fontSize: '14px', fontWeight: 600, marginBottom: '8px', color: 'var(--color-accent)' }}>
              🐛 GitHub Issues
            </div>
            <a
              href="https://github.com/chrysogonum/bird-sound-game/issues"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                color: 'var(--color-text)',
                textDecoration: 'none',
                fontSize: '14px',
              }}
            >
              github.com/chrysogonum/bird-sound-game/issues
            </a>
          </div>
        </Section>

        {/* Version History */}
        <div ref={versionHistoryRef}>
          <Section
            title="Version History"
            isExpanded={expandedSections.has('Version History')}
            onToggle={() => toggleSection('Version History')}
        >
          <VersionEntry version="3.38" date="January 20, 2026">
            <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '14px', color: 'var(--color-text-muted)' }}>
              <li><strong>Taxonomy Migration:</strong> Updated all bird species codes to 2025 AOS/IBP taxonomy - migrated 5 codes (AMGO→AGOL, CEWA→CEDW, SASP→SAVS, WESJ→CASJ, EWPE→EAWP) and fixed species names to match current ornithological standards</li>
              <li><strong>Data Audit System:</strong> Added comprehensive species data validation tools to ensure 100% consistency between game data and the authoritative IBP-AOS-list25.csv taxonomy reference</li>
              <li><strong>Bug Fix:</strong> Fixed taxonomic sort toggle re-shuffling birds on preview screen - now correctly re-orders existing birds without selecting new random ones</li>
              <li><strong>Preview Screen Redesign:</strong> Completely overhauled "Ready to Play" page for better space efficiency - compact header, side-by-side toggles, larger bird grid visibility, and new tip box explaining grid positions</li>
              <li><strong>Training Mode Visual Update:</strong> Training mode toggle now highlights in green (instead of orange) for better visual distinction from other controls</li>
              <li><strong>Sort Button Clarity:</strong> Alphabetical sort now displays as "Sort" by default, switching to "Taxonomic 🐦🤓" when phylogenetic ordering is active</li>
              <li><strong>Bird Reference Quick Access:</strong> Added 📚 book icon button on preview screen that jumps directly to the pack's Bird Reference section with auto-expansion - includes "Ready to Play?" button for easy return</li>
              <li><strong>Help Page Navigation:</strong> Added paired navigation buttons in bottom-right corner: green "↑ Top" for scroll-to-top and orange "Expand/Collapse All" for section management</li>
              <li><strong>Preview Instructions:</strong> Updated preview text to "Tap to preview signature song. Press and hold to get a closer look!" for clearer user guidance</li>
            </ul>
          </VersionEntry>

          <VersionEntry version="3.37" date="January 19, 2026">
            <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '14px', color: 'var(--color-text-muted)' }}>
              <li><strong>Help Documentation:</strong> Added dedicated "Taxonomic Sorting" section to Help page - explains phylogenetic ordering, scientific name display, and how the feature works during gameplay</li>
              <li><strong>README Update:</strong> Fixed Eastern Backyard Birds species count (5→6, added Robin) and updated version number</li>
            </ul>
          </VersionEntry>

          <VersionEntry version="3.36" date="January 19, 2026">
            <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '14px', color: 'var(--color-text-muted)' }}>
              <li><strong>Taxonomic Sort Toggle:</strong> Added taxonomic/alphabetical sort toggle to pre-round preview screen - when enabled, shows birds in phylogenetic order with scientific names (italicized) instead of common names 🐦🤓</li>
              <li><strong>Button Sort Persistence:</strong> Species buttons during gameplay now respect taxonomic sort preference, making it easier for taxonomically-inclined players to build muscle memory</li>
            </ul>
          </VersionEntry>

          <VersionEntry version="3.35" date="January 19, 2026">
            <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '14px', color: 'var(--color-text-muted)' }}>
              <li><strong>2025 AOS Taxonomy:</strong> Updated all 86 species to official 2025 American Ornithological Society (66th Supplement) taxonomic positions - fixes phylogenetic ordering across all families, especially warblers (Swainson's Warbler now correctly appears before Setophaga radiation)</li>
              <li><strong>Scientific Names Fix:</strong> Corrected numerous errors in displayed scientific names - WEWA now shows <em>Helmitheros vermivorum</em> (not <em>Setophaga pensylvanica</em>!), plus 13+ other species fixed to match 2025 AOS data</li>
              <li><strong>Species Data File:</strong> Added comprehensive species.json with common names, scientific names, genus, species epithet, and taxonomic order for all birds - auto-generated from authoritative IBP-AOS-list25.csv</li>
              <li><strong>Custom Pack Builder Icons:</strong> Replaced generic circles with cute illustrated bird icon images - makes custom pack building more visual and fun!</li>
              <li><strong>Data Source:</strong> All taxonomy from The Institute for Bird Populations' official 2025 AOS list (2352 taxa) - scientifically accurate and up-to-date</li>
            </ul>
          </VersionEntry>

          <VersionEntry version="3.34" date="January 19, 2026">
            <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '14px', color: 'var(--color-text-muted)' }}>
              <li><strong>Scientific Names:</strong> Bird Reference now shows scientific names (italicized) below common names when sorted taxonomically - perfect for learning phylogenetic relationships!</li>
              <li><strong>Pack Select UX:</strong> Enhanced grasshopper sparrow joke to read "6 levels/pack—start @ #1, 🦗 sparrow" - more punchy and visual</li>
              <li><strong>OCWA Clips:</strong> Added 7 new Orange-crowned Warbler clips from Xeno-Canto (6 songs, 1 call) - all quality A recordings for expanded species coverage</li>
              <li><strong>Audio Quality:</strong> Trimmed OCWA_985696 to remove interfering bird vocalization at beginning - now shows clean warbler song only</li>
              <li><strong>Data Fixes:</strong> Removed duplicate OCWA_1046368 entry in clips database, set OCWA_976251 as canonical clip, removed low-quality SASP_1060896 clip</li>
              <li><strong>Home Page:</strong> Tightened spacing between title and tagline for better visual balance</li>
            </ul>
          </VersionEntry>

          <VersionEntry version="3.33" date="January 19, 2026">
            <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '14px', color: 'var(--color-text-muted)' }}>
              <li><strong>Taxonomic Sort:</strong> Bird Reference now supports eBird/Clements 2025 taxonomic order - toggle between alphabetical and phylogenetic sorting with a fun easter egg for the science nerds</li>
              <li><strong>Species Fixes:</strong> Corrected Carolina Wren code from CAWR to CARW, and Barred Owl from BADO to BAOW - now matches eBird standard across all packs and data files</li>
              <li><strong>American Robin:</strong> Added AMRO to starter pack (now 6 birds) - merged PR #4 with Cornell/Macaulay Library attribution</li>
              <li><strong>Pack Naming:</strong> Simplified "Common Eastern US Backyard Birds" to just "Eastern Backyard Birds" everywhere</li>
              <li><strong>Help Page Polish:</strong> Alphabetized bird list in pack descriptions, added "There are exceptions. Because, ornithology." note to 4-letter codes section</li>
              <li><strong>Help Navigation Fix:</strong> Fixed unwanted auto-scroll when expanding sections after navigating from Pack Select with hash links</li>
            </ul>
          </VersionEntry>

          <VersionEntry version="3.32" date="January 18, 2026">
            <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '14px', color: 'var(--color-text-muted)' }}>
              <li><strong>Pack Select UX:</strong> Simplified intro bullets with direct links to Help (Training Mode section) and Settings - reduced text, added helpful navigation</li>
              <li><strong>Back Button Enhancement:</strong> Made back buttons more prominent on Help and Settings pages (orange color, "Back" text instead of just icon) for better PWA navigation visibility</li>
              <li><strong>Settings Copy:</strong> Updated Support section with friendlier wording</li>
            </ul>
          </VersionEntry>

          <VersionEntry version="3.31" date="January 18, 2026">
            <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '14px', color: 'var(--color-text-muted)' }}>
              <li><strong>Bird Reference Link:</strong> Made "Bird Reference" in Tips section clickable - now all references to Pack Select have proper back navigation in PWA mode!</li>
            </ul>
          </VersionEntry>

          <VersionEntry version="3.30" date="January 18, 2026">
            <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '14px', color: 'var(--color-text-muted)' }}>
              <li><strong>PWA Navigation Fix:</strong> Added "Back to Help" button on Bird Reference screen when navigated from Help page's About & Credits section - complete PWA navigation coverage!</li>
            </ul>
          </VersionEntry>

          <VersionEntry version="3.29" date="January 18, 2026">
            <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '14px', color: 'var(--color-text-muted)' }}>
              <li><strong>PWA Navigation Enhancement:</strong> Added "Back to Level Select" button on Bird Reference screen when navigated from Level Select - no more getting stuck in PWA mode!</li>
              <li><strong>Rejection tracking system:</strong> Clips rejected during review are now logged to prevent re-downloading - no more duplicate review efforts!</li>
              <li><strong>Yellow-rumped Warbler (YRWA) quality improvements:</strong> Curated down to 2 high-quality clips (from 14 candidates) - improved from Q3 to Q4 with better song/call diversity</li>
              <li><strong>Cedar Waxwing (CEWA) audit:</strong> Reviewed and optimized clip selection for better quality and vocalization diversity</li>
            </ul>
          </VersionEntry>

          <VersionEntry version="3.28" date="January 18, 2026">
            <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '14px', color: 'var(--color-text-muted)' }}>
              <li><strong>Bird Reference Navigation:</strong> Added contextual "Bird Reference" link from Level Select screen that jumps directly to the selected pack's bird list - easily review sounds before starting a level</li>
              <li><strong>Improved Xeno-canto Attribution:</strong> Now displays XC catalog numbers (e.g., "XC1015145 - David A. Brinkman") for proper credit and licensing compliance</li>
              <li><strong>Deep Linking:</strong> Navigate directly to Bird Reference section from Help page with smooth scrolling</li>
              <li><strong>Pack Auto-Expansion:</strong> When navigating from Level Select, the relevant pack automatically expands in Bird Reference</li>
            </ul>
          </VersionEntry>

          <VersionEntry version="3.27" date="January 18, 2026">
            <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '14px', color: 'var(--color-text-muted)' }}>
              <li><strong>Share Card UX:</strong> Improved share instructions with upward arrow emoji and clearer text "Press and hold the image above" to prevent confusion</li>
            </ul>
          </VersionEntry>

          <VersionEntry version="3.26" date="January 18, 2026">
            <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '14px', color: 'var(--color-text-muted)' }}>
              <li><strong>PWA Home Screen Fix:</strong> Fixed 404 error when adding ChipNotes to iPhone home screen - start_url now correctly points to root path</li>
              <li><strong>Manifest Update:</strong> Updated PWA description to match new tagline "Train your ear. Know the birds."</li>
            </ul>
          </VersionEntry>

          <VersionEntry version="3.25" date="January 18, 2026">
            <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '14px', color: 'var(--color-text-muted)' }}>
              <li><strong>Home Screen Refresh:</strong> New tagline "Train your ear. Know the birds." emphasizes the educational journey and real-world birding payoff</li>
              <li><strong>Enhanced Visual Flow:</strong> Added 3-step "Hear → Match → Train" diagram with brain icon to clearly show the learning process</li>
              <li><strong>Cleaner Layout:</strong> Redesigned home screen with tighter spacing and more intuitive visual hierarchy</li>
            </ul>
          </VersionEntry>

          <VersionEntry version="3.24" date="January 18, 2026">
            <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '14px', color: 'var(--color-text-muted)' }}>
              <li><strong>Share Card Polish:</strong> Refined share card design with circular bird icons and owl mascot, cleaner font hierarchy (removed monospace, reduced bold usage), and improved spacing for better visual balance</li>
              <li><strong>Icon Improvements:</strong> Bird icons and owl now display as perfect circles with proper aspect ratio scaling - no more white backgrounds or distortion</li>
              <li><strong>Layout Refinement:</strong> Moved Best Streak above bird icons, tightened spacing between pack/level and bird codes, centered text better in available space</li>
            </ul>
          </VersionEntry>

          <VersionEntry version="3.23" date="January 17, 2026">
            <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '14px', color: 'var(--color-text-muted)' }}>
              <li><strong>Share Score Card:</strong> New shareable score card feature - download or share your round results with fun bird icons, stats, and confusion matrix highlights</li>
              <li><strong>Custom Domain:</strong> ChipNotes now available at <a href="https://chipnotes.app" style={{ color: 'var(--color-accent)' }}>chipnotes.app</a> - easier to remember and share!</li>
              <li><strong>Training Mode indicator:</strong> Share cards now show when Training Mode was used during the round</li>
            </ul>
          </VersionEntry>

          <VersionEntry version="3.22" date="January 17, 2026">
            <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '14px', color: 'var(--color-text-muted)' }}>
              <li><strong>Version chronology fix:</strong> Moved v3.02 and v3.03 to correct position in version history (after v3.13, before v2.0) - no more time-traveling versions!</li>
            </ul>
          </VersionEntry>

          <VersionEntry version="3.21" date="January 17, 2026">
            <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '14px', color: 'var(--color-text-muted)' }}>
              <li><strong>All Birds pack race condition fix:</strong> Fixed state management bug where pack JSON loading overwrote the All Birds pack, causing it to disappear - now merges state correctly to preserve all packs</li>
              <li><strong>Clickable version number:</strong> Main menu version now links to Version History - auto-expands and scrolls to changelog</li>
            </ul>
          </VersionEntry>

          <VersionEntry version="3.20" date="January 17, 2026">
            <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '14px', color: 'var(--color-text-muted)' }}>
              <li><strong>Service worker cache fix:</strong> Fixed "Twilight Zone" bug where All Birds pack appeared on first load but disappeared after refresh - hashed JS bundles no longer cached, ensuring fresh code always loads</li>
              <li><strong>PWA stability:</strong> Installed PWAs now properly update to show latest changes without requiring reinstall</li>
            </ul>
          </VersionEntry>

          <VersionEntry version="3.19" date="January 17, 2026">
            <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '14px', color: 'var(--color-text-muted)' }}>
              <li><strong>Version numbering fix:</strong> Renamed v3.4 to v3.19 to maintain sequential ordering - fixes Apple-style confusion where 3.4 appeared after 3.18</li>
              <li><strong>Help page UX:</strong> Collapsible sections with floating Expand All button - less scrolling, more scanning</li>
              <li><strong>All Birds reference:</strong> Fixed missing bird icons in Bird Reference pack</li>
              <li><strong>Navigation improvements:</strong> Added Back button at bottom of Help page, Help link in Settings for easy cross-navigation</li>
              <li><strong>Support link:</strong> Ko-fi donation link added to Settings - buy me a coffee if ChipNotes helps you ID more birds</li>
              <li><strong>Tech description restored:</strong> Brought back the detailed tech paragraph about TypeScript, React, PixiJS, and PWA offline caching</li>
              <li><strong>Privacy language:</strong> Updated Settings privacy text to be more neutral and less "we"-focused, "not stalking you" instead of "them"</li>
              <li><strong>Credits update:</strong> Added Cornell Macaulay Library, user contributions, and Bird Reference attribution</li>
              <li><strong>Project timeline:</strong> Documented creation timeline (Jan 8-11, 2026) and Claude Code collaboration</li>
              <li><strong>Voice consistency:</strong> Changed "we" to "I" in Feedback section</li>
            </ul>
          </VersionEntry>

          <VersionEntry version="3.18" date="January 17, 2026">
            <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '14px', color: 'var(--color-text-muted)' }}>
              <li><strong>UI polish:</strong> Streamlined pack selection, tightened layout, less visual clutter</li>
              <li><strong>Custom Pack Builder:</strong> Sticky "Start" button stays visible with iOS keyboard, auto-focus for rapid bird entry, added preview tip</li>
              <li><strong>Help page:</strong> Reorganized sections, added creator attribution</li>
              <li><strong>Privacy page:</strong> Full privacy policy accessible from Settings</li>
              <li><strong>Analytics fix:</strong> Fixed gtag initialization pattern - tracking now works correctly</li>
            </ul>
          </VersionEntry>

          <VersionEntry version="3.17" date="January 16, 2026">
            <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '14px', color: 'var(--color-text-muted)' }}>
              <li><strong>Cookie consent:</strong> I know I'm a stranger, but please accept my cookies! It really helps me document how many players I have and which birds everyone loves. (GDPR-compliant banner now appears on first visit)</li>
              <li><strong>Privacy controls:</strong> Changed your mind? New "Analytics Cookies" toggle in Settings lets you opt in/out anytime</li>
              <li><strong>Your data is safe:</strong> IP anonymization enabled, secure cookie flags set, full GDPR/CCPA compliance - I promise I'm just adding bird nerds to my LIFE LIST, not stalking you</li>
            </ul>
          </VersionEntry>

          <VersionEntry version="3.16" date="January 16, 2026">
            <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '14px', color: 'var(--color-text-muted)' }}>
              <li><strong>Bird Reference enhancement:</strong> Separated display species (39) from gameplay rotation (27) for Expanded Eastern US Birds pack - Bird Reference now shows all available species for preview</li>
              <li><strong>UI improvements:</strong> Streamlined pack selection tips, improved Help page tips with confusion matrix mention</li>
            </ul>
          </VersionEntry>

          <VersionEntry version="3.15" date="January 16, 2026">
            <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '14px', color: 'var(--color-text-muted)' }}>
              <li><strong>Xeno-canto attribution:</strong> All Xeno-canto recordings now display recordist names for legal compliance (355 recordings attributed to 87+ contributors)</li>
              <li><strong>Help page enhancements:</strong> Added "Why Learn Bird Song?" section explaining the educational value of left/right audio training, tech details about PWA offline caching</li>
              <li><strong>Audio curation:</strong> Extensive clip review and quality improvements - refined canonical clips, updated vocalization types (call/song/drum), removed low-quality recordings</li>
              <li><strong>UI improvements:</strong> Moved shuffle button above bird grid for better visibility, added "Coming Soon" banner to Stats screen to clarify demo data</li>
              <li><strong>New bird icons:</strong> Added icons for upcoming Macaulay species (ACFL, EAPH, EWPE, WEVI)</li>
            </ul>
          </VersionEntry>

          <VersionEntry version="3.14" date="January 15, 2026">
            <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '14px', color: 'var(--color-text-muted)' }}>
              <li><strong>Analytics:</strong> Added Google Analytics 4 tracking for usage insights (page views, pack/level selections, Training Mode adoption)</li>
              <li><strong>Data fixes:</strong> Restored BCCH, MODO, and WBNU clips lost during Cornell CD processing</li>
            </ul>
          </VersionEntry>

          <VersionEntry version="3.13" date="January 15, 2026">
            <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '14px', color: 'var(--color-text-muted)' }}>
              <li><strong>Western Backyard Birds pack:</strong> 14 new species including Steller's Jay, Western Scrub-Jay, Black-capped Chickadee, and more. Fixed to use 9 random birds per round.</li>
              <li><strong>Audio improvements:</strong> Restored canonical clips for 71+ species, resolved 202 broken audio references, cleaned up duplicate EATO clips (11→5)</li>
              <li><strong>UI refinements:</strong> Black backgrounds on Training Mode labels for better readability, Warbler Academy icon updated to Blackburnian Warbler, improved loading indicators</li>
              <li><strong>Bird Reference enhancements:</strong> Collapsible packs with expand/collapse controls, source badges (Xeno-canto, Cornell, contributors), pack cards with representative bird icons</li>
              <li><strong>Fixed blank spectrograms</strong> (async texture loading), added pull-to-refresh on main menu, audio preloading on preview screen</li>
              <li>Added White-crowned Sparrow to Sparrows pack (now 8 species)</li>
            </ul>
          </VersionEntry>

          <VersionEntry version="3.03" date="January 17, 2026">
            <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '14px', color: 'var(--color-text-muted)' }}>
              <li><strong>Quit button:</strong> Added X button during gameplay to quit rounds early with confirmation</li>
              <li><strong>Support section:</strong> Added Ko-fi donation link and encouragement to support Cornell Macaulay Library and Xeno-Canto</li>
            </ul>
          </VersionEntry>

          <VersionEntry version="3.02" date="January 17, 2026">
            <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '14px', color: 'var(--color-text-muted)' }}>
              <li><strong>Mobile navigation fix:</strong> Bottom menu icons now properly visible on both Safari and Chrome mobile browsers</li>
              <li><strong>Fullscreen tip:</strong> Added browser guidance for best mobile experience</li>
              <li><strong>PWA improvements:</strong> Enhanced Apple mobile web app support</li>
            </ul>
          </VersionEntry>

          <VersionEntry version="2.0" date="January 12, 2026">
            <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '14px', color: 'var(--color-text-muted)' }}>
              <li>Rebranded to ChipNotes! with Owl Professor mascot</li>
              <li>Training Mode: Toggle eye icon to show bird labels on tiles</li>
              <li>Warbler Academy pack: 33 wood-warbler species for experts</li>
              <li>Complete icon set: Hand-illustrated icons for all 91+ species</li>
              <li>Added Eastern Towhee to Expanded Backyard pack</li>
              <li>Birds now persist between rounds by default</li>
              <li>Fixed scoring to allow full 100 points as documented</li>
              <li>iOS audio improvements and playback fixes</li>
            </ul>
          </VersionEntry>

          <VersionEntry version="1.0" date="January 11, 2026">
            <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '14px', color: 'var(--color-text-muted)' }}>
              <li>Initial release with 6 bird packs</li>
              <li>Pre-round preview screen to hear and see birds before playing</li>
              <li>Custom pack builder for targeted practice</li>
              <li>Continuous play mode (untimed, relaxed practice)</li>
              <li>Enhanced round summary with per-species breakdown</li>
              <li>Progressive difficulty: 6 levels per pack</li>
              <li>Real spectrograms for visual learning</li>
              <li>PWA support for offline play and mobile installation</li>
            </ul>
          </VersionEntry>
        </Section>
        </div>

        {/* Bottom navigation */}
        <div style={{
          marginTop: '32px',
          paddingTop: '24px',
          borderTop: '1px solid var(--color-surface)',
          display: 'flex',
          justifyContent: 'center'
        }}>
          <button
            className="btn-secondary"
            onClick={() => location.state?.fromPackSelect ? navigate('/pack-select') : navigate(-1)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '12px 24px',
              background: 'var(--color-accent)',
              color: 'white',
              border: 'none',
            }}
          >
            <BackIcon />
            Back
          </button>
        </div>
      </div>

      {/* Floating buttons - visible after scroll */}
      {hasScrolled && (
        <div style={{
          position: 'fixed',
          bottom: 'calc(24px + var(--safe-area-bottom, 0px))',
          right: '24px',
          display: 'flex',
          gap: '8px',
          zIndex: 1000,
        }}>
          {/* Scroll to top button */}
          <button
            onClick={scrollToTop}
            style={{
              padding: '6px 10px',
              fontSize: '11px',
              fontWeight: 600,
              background: 'rgba(76, 175, 80, 0.15)',
              color: 'var(--color-success)',
              border: '1px solid rgba(76, 175, 80, 0.3)',
              borderRadius: '12px',
              cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
              transition: 'all 0.2s',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'scale(1.05)';
              e.currentTarget.style.background = 'rgba(76, 175, 80, 0.25)';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.25)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'scale(1)';
              e.currentTarget.style.background = 'rgba(76, 175, 80, 0.15)';
              e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.2)';
            }}
            aria-label="Scroll to top"
          >
            <span style={{ fontSize: '12px' }}>↑</span>
            Top
          </button>

          {/* Expand/Collapse All button */}
          <button
            onClick={toggleAll}
            style={{
              padding: '6px 10px',
              fontSize: '11px',
              fontWeight: 600,
              background: 'rgba(255, 152, 0, 0.15)',
              color: 'var(--color-accent)',
              border: '1px solid rgba(255, 152, 0, 0.3)',
              borderRadius: '12px',
              cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
              transition: 'all 0.2s',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'scale(1.05)';
              e.currentTarget.style.background = 'rgba(255, 152, 0, 0.25)';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.25)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'scale(1)';
              e.currentTarget.style.background = 'rgba(255, 152, 0, 0.15)';
              e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.2)';
            }}
          >
            <span style={{ fontSize: '12px' }}>
              {allExpanded ? '▲' : '▼'}
            </span>
            {allExpanded ? 'Collapse All' : 'Expand All'}
          </button>
        </div>
      )}
    </div>
  );
}

function Section({ id, title, children, isExpanded, onToggle }: {
  id?: string;
  title: string;
  children: React.ReactNode;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  return (
    <div id={id} style={{ marginBottom: '16px', scrollMarginTop: '20px' }}>
      <h3
        onClick={onToggle}
        style={{
          fontSize: '16px',
          fontWeight: 600,
          marginBottom: isExpanded ? '12px' : '0',
          color: 'var(--color-accent)',
          borderBottom: '1px solid var(--color-surface)',
          paddingBottom: '8px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          transition: 'color 0.2s',
          userSelect: 'none',
        }}
        onMouseEnter={(e) => e.currentTarget.style.color = '#FFA726'}
        onMouseLeave={(e) => e.currentTarget.style.color = 'var(--color-accent)'}
      >
        <span style={{
          fontSize: '14px',
          width: '14px',
          textAlign: 'center',
          flexShrink: 0
        }}>
          {isExpanded ? '▼' : '▶'}
        </span>
        {title}
      </h3>
      {isExpanded && (
        <div style={{ fontSize: '15px', lineHeight: 1.6, color: 'var(--color-text)' }}>
          {children}
        </div>
      )}
    </div>
  );
}

function ScoreRow({ label, points, description, color }: { label: string; points: number; description: string; color: string }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      marginBottom: '8px',
      padding: '8px 12px',
      background: 'var(--color-surface)',
      borderRadius: '8px',
    }}>
      <span style={{
        fontFamily: 'var(--font-mono)',
        fontWeight: 700,
        color,
        minWidth: '40px',
      }}>
        +{points}
      </span>
      <div>
        <span style={{ fontWeight: 600 }}>{label}</span>
        <span style={{ color: 'var(--color-text-muted)', marginLeft: '8px', fontSize: '13px' }}>
          {description}
        </span>
      </div>
    </div>
  );
}

function PackInfo({ name, description }: { name: string; description: string }) {
  return (
    <div style={{
      marginBottom: '12px',
      padding: '12px',
      background: 'var(--color-surface)',
      borderRadius: '8px',
    }}>
      <div style={{ fontWeight: 600, marginBottom: '4px' }}>{name}</div>
      <div style={{ fontSize: '14px', color: 'var(--color-text-muted)' }}>{description}</div>
    </div>
  );
}

function LevelInfo({ level, title, description }: { level: number; title: string; description: string }) {
  return (
    <div style={{
      display: 'flex',
      gap: '12px',
      marginBottom: '8px',
      padding: '8px 12px',
      background: 'var(--color-surface)',
      borderRadius: '8px',
    }}>
      <span style={{
        fontFamily: 'var(--font-mono)',
        fontWeight: 700,
        color: 'var(--color-accent)',
        minWidth: '24px',
      }}>
        {level}
      </span>
      <div>
        <span style={{ fontWeight: 600 }}>{title}</span>
        <div style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>{description}</div>
      </div>
    </div>
  );
}

function Tip({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'flex-start',
      gap: '8px',
      marginBottom: '8px',
      fontSize: '14px',
    }}>
      <span style={{ color: 'var(--color-accent)' }}>•</span>
      <span>{children}</span>
    </div>
  );
}

function VersionEntry({ version, date, children }: { version: string; date: string; children: React.ReactNode }) {
  return (
    <div style={{
      marginBottom: '16px',
      padding: '12px',
      background: 'var(--color-surface)',
      borderRadius: '8px',
      borderLeft: '3px solid var(--color-accent)',
    }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '8px' }}>
        <span style={{ fontWeight: 700, fontSize: '16px', color: 'var(--color-accent)' }}>v{version}</span>
        <span style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>{date}</span>
      </div>
      {children}
    </div>
  );
}

function BackIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M15 18l-6-6 6-6" />
    </svg>
  );
}

export default Help;
