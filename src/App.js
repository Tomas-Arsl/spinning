import React, { useState, useRef, useEffect } from 'react';
import './App.css';
import confetti from 'canvas-confetti';

const bgUrl = process.env.PUBLIC_URL + '/marmena.jpg';

const defaultChoices = [
  { label: "نعم", quantity: 5, image: null, probability: 50 },
  { label: "لا", quantity: 5, image: null, probability: 50 }
];

const colors = [
  "#e74c3c", "#2980b9", "#f7ca18", "#222",
  "#f5f5dc", "#e67e22", "#3498db", "#c0392b"
];

function getRandomInt(max) {
  return Math.floor(Math.random() * max);
}

// For the wheel: always show all choices, even if quantity is 0 (but only allow spinning if at least one has quantity > 0)
function getWeightedSegments(choices) {
  return choices.map(c => ({ label: c.label, image: c.image, quantity: c.quantity, probability: c.probability }));
}

function App() {
  const [page, setPage] = useState("spin");
  const [choices, setChoices] = useState(() => {
    const saved = localStorage.getItem('choices');
    return saved ? JSON.parse(saved) : defaultChoices;
  });

  useEffect(() => {
    localStorage.setItem('choices', JSON.stringify(choices));
  }, [choices]);

  const [spinning, setSpinning] = useState(false);
  const [angle, setAngle] = useState(0);
  const [result, setResult] = useState(null);

  const [newLabel, setNewLabel] = useState('');
  const [newQuantity, setNewQuantity] = useState(1);
  const [newProbability, setNewProbability] = useState(50);
  const [editIdx, setEditIdx] = useState(null);
  const [editLabel, setEditLabel] = useState('');
  const [editQuantity, setEditQuantity] = useState(1);
  const [editProbability, setEditProbability] = useState(50);
  const [newImage, setNewImage] = useState(null);
  const [editImage, setEditImage] = useState(null);

  const celebrationTimeout = useRef(null);
  const audioRef = useRef(null);

  const availableChoices = choices; // Show all, don't filter by quantity
  const weightedSegments = getWeightedSegments(availableChoices);
  const segments = weightedSegments.map(s => s.label);
  const images = weightedSegments.map(s => s.image);
  const quantities = weightedSegments.map(s => s.quantity);
  const probabilities = weightedSegments.map(s => s.probability);

  // --- SPIN LOGIC ---
  const spinWheel = () => {
    // Only allow spinning if at least one has quantity > 0
    if (spinning || !choices.some(c => c.quantity > 0) || segments.length === 0) return;
    setSpinning(true);
    setResult(null);

    // Weighted random pick: use probability to influence selection, only from those with quantity > 0
    let totalWeight = 0;
    weightedSegments.forEach((c, idx) => {
      if (c.quantity > 0) totalWeight += c.probability;
    });
    if (totalWeight === 0) return;

    const random = getRandomInt(totalWeight);
    let cumulativeWeight = 0;
    let pickedIdx = -1;

    for (let i = 0; i < weightedSegments.length; i++) {
      if (weightedSegments[i].quantity > 0) {
        cumulativeWeight += weightedSegments[i].probability;
        if (random < cumulativeWeight) {
          pickedIdx = i;
          break;
        }
      }
    }

    if (pickedIdx === -1) return; // Fallback if no valid pick

    const spins = 6; // Increased spins for faster animation
    const anglePerSegment = 360 / segments.length;
    const finalAngle = 360 * spins + (360 - pickedIdx * anglePerSegment - anglePerSegment / 2);
    setAngle(finalAngle);

    setTimeout(() => {
      setSpinning(false);
      setResult(pickedIdx);
      setChoices(prev =>
        prev.map((c, i) =>
          i === pickedIdx
            ? { ...c, quantity: Math.max(0, c.quantity - 1) }
            : c
        )
      );
      // Clear spin state after spin completes
      localStorage.removeItem('spin_angle');
      localStorage.removeItem('spin_spinning');
    }, 2000); // or your animation duration
  };

  useEffect(() => {
    if (result !== null) {
      const duration = 2 * 1000;
      const animationEnd = Date.now() + duration;
      const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 9999 };
      function randomInRange(min, max) {
        return Math.random() * (max - min) + min;
      }
      function shoot() {
        confetti({
          ...defaults,
          particleCount: 60,
          origin: { x: randomInRange(0.1, 0.9), y: randomInRange(0.1, 0.5) }
        });
      }
      shoot(); shoot(); shoot();
      function frame() {
        shoot();
        if (Date.now() < animationEnd) {
          celebrationTimeout.current = setTimeout(frame, 350);
        }
      }
      frame();
      if (audioRef.current) {
        audioRef.current.currentTime = 0;
        audioRef.current.play();
        const stopTimeout = setTimeout(() => {
          if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.currentTime = 0;
          }
        }, 5000);
        return () => {
          clearTimeout(celebrationTimeout.current);
          clearTimeout(stopTimeout);
          if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.currentTime = 0;
          }
        };
      }
      return () => clearTimeout(celebrationTimeout.current);
    }
  }, [result]);

  const handleAdd = e => {
    e.preventDefault();
    const label = newLabel.trim();
    const quantity = Math.max(1, parseInt(newQuantity) || 1);
    const probability = Math.max(1, Math.min(100, parseInt(newProbability) || 50)); // Clamp between 1 and 100
    if (!label) return;
    if (choices.some(c => c.label === label)) return;
    setChoices([...choices, { label, quantity, image: newImage, probability }]);
    setNewLabel('');
    setNewQuantity(1);
    setNewProbability(50);
    setNewImage(null);
  };

  const handleDelete = idx => {
    setChoices(choices => choices.filter((_, i) => i !== idx));
    setEditIdx(null);
  };

  const handleEdit = idx => {
    setEditIdx(idx);
    setEditLabel(choices[idx].label);
    setEditQuantity(choices[idx].quantity);
    setEditProbability(choices[idx].probability);
    setEditImage(choices[idx].image || null);
  };

  const handleEditSave = idx => {
    const label = editLabel.trim();
    const quantity = Math.max(0, parseInt(editQuantity) || 0); // Allow 0 for visibility
    const probability = Math.max(1, Math.min(100, parseInt(editProbability) || 50)); // Clamp between 1 and 100
    if (!label) return;
    if (choices.some((c, i) => c.label === label && i !== idx)) return;
    setChoices(choices =>
      choices.map((c, i) =>
        i === idx ? { ...c, label, quantity, probability, image: editImage } : c
      )
    );
    setEditIdx(null);
    setEditImage(null);
  };

  const handleEditCancel = () => {
    setEditIdx(null);
  };

  // Responsive wheel size: make it bigger and more realistic
  const wheelSize = Math.min(window.innerWidth, window.innerHeight) * 0.65; // Bigger
  const radius = wheelSize / 2 - 20;
  const center = wheelSize / 2;
  const anglePer = segments.length ? 360 / segments.length : 360;

  // Function to reset to initial state
  const resetToInitialState = () => {
    setResult(null);
    setAngle(0);
    setSpinning(false);
    localStorage.removeItem('spin_angle');
    localStorage.removeItem('spin_spinning');
    // Reset choices to default if needed, or keep current choices as is
    // Uncomment the line below if you want to reset choices to defaultChoices
    // setChoices(defaultChoices);
  };

  return (
    <div
      className="App"
      style={{
        minHeight: "100vh",
        minWidth: "100vw",
        height: "100vh",
        width: "100vw",
        padding: 0,
        margin: 0,
        background: `url(${bgUrl}) center center / cover no-repeat, #f5f5dc`,
        position: "fixed",
        top: 0,
        left: 0,
        overflow: "hidden",
        display: "flex",
        alignItems: "center",
        justifyContent: "center"
      }}
    >
      <audio ref={audioRef} src={process.env.PUBLIC_URL + '/soundeffect.mp3'} preload="auto" />
      <div style={{
        background: "rgba(245,245,220,0.92)",
        minHeight: "100vh",
        minWidth: "100vw",
        height: "100vh",
        width: "100vw",
        position: "absolute",
        top: 0, left: 0, zIndex: 0,
        overflow: "hidden"
      }} />
      <div style={{
        position: "relative",
        zIndex: 1,
        height: "100vh",
        width: "100vw",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden"
      }}>
        <div style={{
          position: "absolute",
          top: 16,
          left: 0,
          right: 0,
          display: "flex",
          justifyContent: "center",
          zIndex: 100
        }}>
          <button
            onClick={() => setPage("spin")}
            style={{
              background: page === "spin" ? "#2980b9" : "#fff",
              color: page === "spin" ? "#fff" : "#2980b9",
              border: "2px solid #2980b9",
              borderRadius: 8,
              padding: "8px 24px",
              fontWeight: "bold",
              fontSize: 18,
              marginRight: 8,
              cursor: "pointer"
            }}
          >العجلة</button>
          <button
            onClick={() => setPage("manage")}
            style={{
              background: page === "manage" ? "#2980b9" : "#fff",
              color: page === "manage" ? "#fff" : "#2980b9",
              border: "2px solid #2980b9",
              borderRadius: 8,
              padding: "8px 24px",
              fontWeight: "bold",
              fontSize: 18,
              marginLeft: 8,
              cursor: "pointer"
            }}
          >الاختيارات</button>
        </div>
        {page === "spin" && (
          <div style={{
            width: "100vw",
            maxWidth: 600,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "1.5vw"
          }}>
            <h1 style={{
              fontFamily: "Cairo, Arial, sans-serif",
              color: "#e74c3c",
              letterSpacing: 2,
              fontWeight: "bold",
              fontSize: "clamp(1.2rem, 3vw, 2.2rem)",
              textAlign: "center",
              margin: 0
            }}>
              اسرة مارمينا للجامعيين والخريجين
            </h1>
            <h2 style={{
              fontFamily: "Cairo, Arial, sans-serif",
              color: "#222",
              fontWeight: "bold",
              fontSize: "clamp(1rem, 2vw, 1.3rem)",
              margin: 0,
              textAlign: "center"
            }}>
              AVA MINA FAMILY
            </h2>
            <div style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              width: "100%",
              maxWidth: 700,
              margin: 0
            }}>
              <div style={{
                position: "relative",
                width: wheelSize,
                height: wheelSize,
                maxWidth: "98vw",
                maxHeight: "70vh",
                margin: "0 auto"
              }}>
                <svg
                  width={wheelSize}
                  height={wheelSize}
                  style={{
                    transform: `rotate(${angle}deg)`,
                    transition: spinning
                      ? "transform 2s cubic-bezier(0.5, 0, 0.8, 0.3)"
                      : "none"
                  }}
                >
                  {/* Wheel shadow for realism */}
                  <ellipse
                    cx={center}
                    cy={center + 18}
                    rx={radius * 0.95}
                    ry={radius * 0.18}
                    fill="#0002"
                  />
                  {/* Wheel segments */}
                  {segments.length === 0 ? (
                    <circle cx={center} cy={center} r={radius} fill="#eee" />
                  ) : segments.map((seg, i) => {
                    const startAngle = i * anglePer - 90;
                    const endAngle = (i + 1) * anglePer - 90;
                    const x1 = center + radius * Math.cos((Math.PI * startAngle) / 180);
                    const y1 = center + radius * Math.sin((Math.PI * startAngle) / 180);
                    const x2 = center + radius * Math.cos((Math.PI * endAngle) / 180);
                    const y2 = center + radius * Math.sin((Math.PI * endAngle) / 180);
                    const largeArc = anglePer > 180 ? 1 : 0;
                    const midAngle = startAngle + anglePer / 2;
                    const labelRadius = radius * 0.7;
                    const labelX = center + labelRadius * Math.cos((Math.PI * midAngle) / 180);
                    const labelY = center + labelRadius * Math.sin((Math.PI * midAngle) / 180);

                    return (
                      <g key={i}>
                        <path
                          d={`M${center},${center} L${x1},${y1} A${radius},${radius} 0 ${largeArc} 1 ${x2},${y2} Z`}
                          fill={colors[i % colors.length]}
                          stroke="#fff"
                          strokeWidth={wheelSize > 300 ? 2.5 : 1.5}
                          style={{ filter: "drop-shadow(0 1px 6px #0002)" }}
                        />
                        {/* Show image and name inside a daisy-like flower, name large and clear below image */}
                        <g>
                          {/* Daisy petals */}
                          {[...Array(8)].map((_, p) => {
                            const petalAngle = (Math.PI * 2 * p) / 8;
                            const petalX = labelX + Math.cos(petalAngle) * (wheelSize * 0.06);
                            const petalY = labelY + Math.sin(petalAngle) * (wheelSize * 0.06);
                            return (
                              <ellipse
                                key={p}
                                cx={petalX}
                                cy={petalY}
                                rx={wheelSize * 0.022}
                                ry={wheelSize * 0.045}
                                fill="#fffbe7"
                                stroke="#e6c200"
                                strokeWidth="1"
                                transform={`rotate(${(petalAngle * 180) / Math.PI},${petalX},${petalY})`}
                              />
                            );
                          })}
                          {/* Daisy center with image */}
                          <circle
                            cx={labelX}
                            cy={labelY}
                            r={wheelSize * 0.055}
                            fill="#fff"
                            stroke="#222"
                            strokeWidth="2"
                            style={{ filter: "drop-shadow(0 2px 6px #0002)" }}
                          />
                          {images[i] && (
                            <clipPath id={`daisy-img-clip-${i}`}>
                              <circle
                                cx={labelX}
                                cy={labelY}
                                r={wheelSize * 0.048}
                              />
                            </clipPath>
                          )}
                          {images[i] && (
                            <image
                              href={images[i]}
                              x={labelX - wheelSize * 0.048}
                              y={labelY - wheelSize * 0.048}
                              width={wheelSize * 0.096}
                              height={wheelSize * 0.096}
                              style={{
                                pointerEvents: "none",
                                userSelect: "none"
                              }}
                              clipPath={`url(#daisy-img-clip-${i})`}
                            />
                          )}
                          {/* Name below the daisy, large and clear */}
                          <text
                            x={labelX}
                            y={labelY + wheelSize * 0.13}
                            textAnchor="middle"
                            fill="#222"
                            fontSize={wheelSize > 300 ? 26 : 18}
                            fontWeight="bold"
                            style={{
                              pointerEvents: "none",
                              userSelect: "none",
                              fontFamily: "Cairo, Arial, sans-serif",
                              textShadow: "0 2px 8px #fff, 0 1px 1px #0002"
                            }}
                            transform={`rotate(${midAngle + 90},${labelX},${labelY})`}
                          >
                            {seg}
                          </text>
                        </g>
                      </g>
                    );
                  })}
                  {/* Wheel center for realism */}
                  <circle
                    cx={center}
                    cy={center}
                    r={wheelSize * 0.08}
                    fill="#fff"
                    stroke="#2980b9"
                    strokeWidth="4"
                    style={{ filter: "drop-shadow(0 2px 8px #0003)" }}
                  />
                </svg>
                {/* Arrow styled like the provided screenshot */}
                {segments.length > 0 && (() => {
                  // Blue triangle arrow, flat, with a slight 3D gradient
                  const arrowW = wheelSize * 0.11;
                  const arrowH = wheelSize * 0.13;
                  return (
                    <svg
                      width={arrowW}
                      height={arrowH}
                      style={{
                        position: "absolute",
                        right: -arrowW * 0.55,
                        top: `calc(50% - ${arrowH / 2}px)`,
                        zIndex: 3,
                        filter: "drop-shadow(0 2px 6px #0007)"
                      }}
                    >
                      <defs>
                        <linearGradient id="arrowBlueGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#4a90e2" />
                          <stop offset="100%" stopColor="#174fa3" />
                        </linearGradient>
                        <linearGradient id="arrowBlueLight" x1="0" y1="0" x2="1" y2="1">
                          <stop offset="0%" stopColor="#b3d1ff" stopOpacity="0.7" />
                          <stop offset="100%" stopColor="#4a90e2" stopOpacity="0" />
                        </linearGradient>
                      </defs>
                      {/* Main triangle */}
                      <polygon
                        points={`
                          0,${arrowH / 2}
                          ${arrowW * 0.95},0
                          ${arrowW * 0.95},${arrowH}
                        `}
                        fill="url(#arrowBlueGrad)"
                        stroke="#174fa3"
                        strokeWidth="2"
                      />
                      {/* Highlight for 3D effect */}
                      <polygon
                        points={`
                          0,${arrowH / 2}
                          ${arrowW * 0.7},${arrowH * 0.13}
                          ${arrowW * 0.7},${arrowH * 0.87}
                        `}
                        fill="url(#arrowBlueLight)"
                        stroke="none"
                      />
                    </svg>
                  );
                })()}
                {/* Spin button */}
                <button
                  onClick={spinWheel}
                  disabled={spinning || !choices.some(c => c.quantity > 0) || segments.length === 0}
                  style={{
                    position: "absolute",
                    left: "50%",
                    top: "50%",
                    transform: "translate(-50%, -50%)",
                    background: "#2980b9",
                    color: "#fff",
                    border: "3px solid #222",
                    borderRadius: "50%",
                    width: wheelSize * 0.28,
                    height: wheelSize * 0.28,
                    fontSize: wheelSize > 300 ? 28 : 18,
                    fontWeight: "bold",
                    cursor: spinning || !choices.some(c => c.quantity > 0) || segments.length === 0 ? "not-allowed" : "pointer",
                    boxShadow: "0 2px 8px #0002",
                    letterSpacing: 2,
                    minWidth: 60,
                    minHeight: 60
                  }}
                >
                  لف
                </button>
              </div>
            </div>
            {result !== null && (
              <div style={{
                position: "fixed",
                top: 0,
                left: 0,
                width: "100vw",
                height: "100vh",
                background: "rgba(255,255,255,0.92)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                zIndex: 10000,
                flexDirection: "column",
                transition: "background 0.3s"
              }}>
                <div style={{
                  fontSize: "clamp(2.5rem, 7vw, 4.5rem)",
                  color: "#e74c3c",
                  fontWeight: "bold",
                  background: "rgba(255,255,255,0.95)",
                  borderRadius: 24,
                  border: "4px solid #2980b9",
                  boxShadow: "0 4px 32px #0002",
                  padding: "2.5rem 3.5rem",
                  textAlign: "center",
                  fontFamily: "Cairo, Arial, sans-serif",
                  letterSpacing: 2,
                  marginBottom: 0,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center"
                }}>
                  <span style={{ fontSize: "1.2em" }}>🎉</span>
                  <div style={{ margin: "0.5em 0" }}>
                    <b>النتيجة:</b>
                  </div>
                  {/* Show image and name if image exists, otherwise just name */}
                  {images[result] ? (
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                      <img
                        src={images[result]}
                        alt={segments[result]}
                        style={{
                          width: 90,
                          height: 90,
                          objectFit: "cover",
                          borderRadius: 16,
                          marginBottom: 12,
                          border: "2.5px solid #2980b9",
                          boxShadow: "0 2px 8px #0002"
                        }}
                      />
                      <div style={{
                        fontSize: "2rem",
                        fontWeight: "bold",
                        color: "#222"
                      }}>{segments[result]}</div>
                    </div>
                  ) : (
                    <div style={{
                      fontSize: "2rem",
                      fontWeight: "bold",
                      color: "#222"
                    }}>{segments[result]}</div>
                  )}
                  <span style={{ fontSize: "1.2em" }}>🎉</span>
                  <div>
                    <button
                      onClick={resetToInitialState}
                      style={{
                        marginTop: "2rem",
                        background: "#2980b9",
                        color: "#fff",
                        border: "none",
                        borderRadius: 10,
                        padding: "12px 36px",
                        fontWeight: "bold",
                        fontSize: "1.2em",
                        cursor: "pointer",
                        boxShadow: "0 2px 8px #0002"
                      }}
                    >
                      تم
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
        {page === "manage" && (
          <div style={{
            width: "100vw",
            maxWidth: 600,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "1.5vw"
          }}>
            <h1 style={{
              fontFamily: "Cairo, Arial, sans-serif",
              color: "#2980b9",
              letterSpacing: 2,
              fontWeight: "bold",
              fontSize: "clamp(1.2rem, 3vw, 2.2rem)",
              textAlign: "center",
              margin: 0
            }}>
              إدارة الاختيارات
            </h1>
            <form onSubmit={handleAdd} style={{
              display: "flex",
              gap: 8,
              marginBottom: 18,
              flexWrap: "wrap",
              background: "#fff",
              borderRadius: 12,
              padding: "18px 18px 8px 18px",
              border: "2px solid #2980b9",
              boxShadow: "0 2px 8px #0001",
              maxWidth: 420,
              width: "100%"
            }}>
              <input
                type="text"
                placeholder="اسم الاختيار"
                value={newLabel}
                onChange={e => setNewLabel(e.target.value)}
                style={{
                  flex: 2,
                  minWidth: 0,
                  padding: 6,
                  borderRadius: 6,
                  border: "1px solid #ccc",
                  fontFamily: "inherit"
                }}
                required
              />
              <input
                type="number"
                min={1}
                value={newQuantity}
                onChange={e => setNewQuantity(e.target.value)}
                style={{
                  width: 60,
                  minWidth: 0,
                  padding: 6,
                  borderRadius: 6,
                  border: "1px solid #ccc"
                }}
                required
              />
              <input
                type="number"
                min={1}
                max={100}
                value={newProbability}
                onChange={e => setNewProbability(e.target.value)}
                style={{
                  width: 60,
                  minWidth: 0,
                  padding: 6,
                  borderRadius: 6,
                  border: "1px solid #ccc"
                }}
                required
              />
              <input
                type="file"
                accept="image/*"
                onChange={e => {
                  const file = e.target.files[0];
                  if (file) {
                    const reader = new FileReader();
                    reader.onload = ev => setNewImage(ev.target.result);
                    reader.readAsDataURL(file);
                  } else {
                    setNewImage(null);
                  }
                }}
                style={{ minWidth: 0 }}
              />
              <button type="submit" style={{
                background: "#2980b9",
                color: "#fff",
                border: "none",
                borderRadius: 6,
                padding: "6px 14px",
                fontWeight: "bold",
                cursor: "pointer",
                minWidth: 60
              }}>اضف</button>
            </form>
            <div style={{
              width: "100%",
              maxWidth: 420,
              background: "#fff",
              borderRadius: 12,
              boxShadow: "0 2px 8px #0001",
              padding: "18px",
              border: "2px solid #2980b9",
              boxSizing: "border-box",
              margin: "1vw 0",
              overflow: "auto",
              maxHeight: "40vh"
            }}>
              {choices.length === 0 && <div style={{ color: "#888" }}>لا يوجد اختيارات.</div>}
              {choices.map((choice, idx) => (
                <div key={idx} style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  marginBottom: 10,
                  flexWrap: "wrap"
                }}>
                  {editIdx === idx ? (
                    <>
                      <input
                        type="text"
                        value={editLabel}
                        onChange={e => setEditLabel(e.target.value)}
                        style={{
                          flex: 2,
                          minWidth: 0,
                          padding: 6,
                          borderRadius: 6,
                          border: "1px solid #ccc",
                          fontFamily: "inherit"
                        }}
                      />
                      <input
                        type="number"
                        min={1}
                        value={editQuantity}
                        onChange={e => setEditQuantity(e.target.value)}
                        style={{
                          width: 60,
                          minWidth: 0,
                          padding: 6,
                          borderRadius: 6,
                          border: "1px solid #ccc"
                        }}
                      />
                      <input
                        type="number"
                        min={1}
                        max={100}
                        value={editProbability}
                        onChange={e => setEditProbability(e.target.value)}
                        style={{
                          width: 60,
                          minWidth: 0,
                          padding: 6,
                          borderRadius: 6,
                          border: "1px solid #ccc"
                        }}
                      />
                      <input
                        type="file"
                        accept="image/*"
                        onChange={e => {
                          const file = e.target.files[0];
                          if (file) {
                            const reader = new FileReader();
                            reader.onload = ev => setEditImage(ev.target.result);
                            reader.readAsDataURL(file);
                          } else {
                            setEditImage(null);
                          }
                        }}
                        style={{ minWidth: 0 }}
                      />
                      {editImage && (
                        <img src={editImage} alt="" style={{ width: 36, height: 36, borderRadius: 6, objectFit: "cover" }} />
                      )}
                      <button onClick={() => handleEditSave(idx)} style={{
                        background: "#4CAF50",
                        color: "#fff",
                        border: "none",
                        borderRadius: 6,
                        padding: "6px 10px",
                        fontWeight: "bold",
                        cursor: "pointer",
                        minWidth: 50
                      }}>حفظ</button>
                      <button onClick={handleEditCancel} style={{
                        background: "#e74c3c",
                        color: "#fff",
                        border: "none",
                        borderRadius: 6,
                        padding: "6px 10px",
                        fontWeight: "bold",
                        cursor: "pointer",
                        minWidth: 50
                      }}>الغاء</button>
                    </>
                  ) : (
                    <>
                      {choice.image && (
                        <img src={choice.image} alt="" style={{ width: 36, height: 36, borderRadius: 6, objectFit: "cover", marginRight: 8 }} />
                      )}
                      <span style={{
                        flex: 2,
                        fontWeight: "bold",
                        fontSize: 18,
                        color: "#222"
                      }}>{choice.label}</span>
                      <input
                        type="number"
                        min={0}
                        value={choice.quantity}
                        onChange={e => {
                          const val = Math.max(0, parseInt(e.target.value) || 0);
                          setChoices(choices =>
                            choices.map((c, i) =>
                              i === idx ? { ...c, quantity: val } : c
                            )
                          );
                        }}
                        style={{
                          width: 60,
                          minWidth: 0,
                          padding: 6,
                          borderRadius: 6,
                          border: "1px solid #ccc",
                          fontWeight: "bold",
                          fontSize: 18,
                          color: "#e74c3c",
                          textAlign: "center"
                        }}
                      />
                      <input
                        type="number"
                        min={1}
                        max={100}
                        value={choice.probability}
                        onChange={e => {
                          const val = Math.max(1, Math.min(100, parseInt(e.target.value) || 50));
                          setChoices(choices =>
                            choices.map((c, i) =>
                              i === idx ? { ...c, probability: val } : c
                            )
                          );
                        }}
                        style={{
                          width: 60,
                          minWidth: 0,
                          padding: 6,
                          borderRadius: 6,
                          border: "1px solid #ccc",
                          fontWeight: "bold",
                          fontSize: 18,
                          color: "#2980b9",
                          textAlign: "center"
                        }}
                      />
                      <button onClick={() => handleEdit(idx)} style={{
                        background: "#2980b9",
                        color: "#fff",
                        border: "none",
                        borderRadius: 6,
                        padding: "6px 10px",
                        fontWeight: "bold",
                        cursor: "pointer",
                        minWidth: 50
                      }}>تعديل</button>
                      <button onClick={() => handleDelete(idx)} style={{
                        background: "#e74c3c",
                        color: "#fff",
                        border: "none",
                        borderRadius: 6,
                        padding: "6px 10px",
                        fontWeight: "bold",
                        cursor: "pointer",
                        minWidth: 50
                      }}>حذف</button>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;