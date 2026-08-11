import { useEffect, useMemo, useRef, useState, type MouseEvent } from 'react';
import type { KnowledgeGraph } from './buildGraph';

type MindmapStationProps = {
  graph: KnowledgeGraph;
  onOpenNode: (id: string) => void;
};

type Point = {
  id: string;
  x: number;
  y: number;
};

export function MindmapStation({ graph, onOpenNode }: MindmapStationProps) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [selected, setSelected] = useState<string>();
  const points = useMemo(() => layout(graph), [graph]);

  useEffect(() => {
    if (!canvas.current) {
      return;
    }
    const element = canvas.current;
    const observer = new ResizeObserver(() => drawGraph(element, graph, points, selected));
    observer.observe(element);
    drawGraph(element, graph, points, selected);
    return () => observer.disconnect();
  }, [graph, points, selected]);

  const selectedNode = graph.nodes.find(node => node.id === selected);

  return (
    <section className="mindmap-station" aria-labelledby="mindmap-title">
      <header className="section-header">
        <div>
          <p className="eyebrow">Knowledge graph</p>
          <h2 id="mindmap-title">Mindmap Station</h2>
        </div>
        <span className="count-label">{graph.nodes.length} notes · {graph.edges.length} links</span>
      </header>
      <div className="graph-stage">
        <canvas
          ref={canvas}
          aria-label="Interactive knowledge graph"
          onClick={event => {
            const id = hitTest(event.currentTarget, event, points);
            setSelected(id);
          }}
          onDoubleClick={event => {
            const id = hitTest(event.currentTarget, event, points);
            if (id) {
              onOpenNode(id);
            }
          }}
        />
        {selectedNode && (
          <aside className="graph-inspector">
            <strong>{selectedNode.title}</strong>
            <span>{selectedNode.path}</span>
            <button type="button" onClick={() => onOpenNode(selectedNode.id)}>Open note</button>
          </aside>
        )}
      </div>
      <details className="accessible-node-list">
        <summary>Browse graph as a list</summary>
        <ul>
          {graph.nodes.map(node => (
            <li key={node.id}>
              <button type="button" onClick={() => onOpenNode(node.id)}>{node.path}</button>
            </li>
          ))}
        </ul>
      </details>
    </section>
  );
}

function layout(graph: KnowledgeGraph): Point[] {
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));
  const positions = new Map<string, Point>();
  graph.nodes.forEach((node, index) => {
    const radius = Math.sqrt((index + 0.5) / Math.max(1, graph.nodes.length)) * 0.86;
    const angle = index * goldenAngle;
    positions.set(node.id, {
      id: node.id,
      x: Math.cos(angle) * radius,
      y: Math.sin(angle) * radius,
    });
  });

  for (let iteration = 0; iteration < 24; iteration += 1) {
    for (const edge of graph.edges) {
      const source = positions.get(edge.source);
      const target = positions.get(edge.target);
      if (!source || !target) {
        continue;
      }
      const dx = target.x - source.x;
      const dy = target.y - source.y;
      const distance = Math.max(0.01, Math.hypot(dx, dy));
      const pull = (distance - 0.22) * 0.018;
      source.x += dx / distance * pull;
      source.y += dy / distance * pull;
      target.x -= dx / distance * pull;
      target.y -= dy / distance * pull;
    }
  }
  return [...positions.values()];
}

function drawGraph(
  canvas: HTMLCanvasElement,
  graph: KnowledgeGraph,
  points: Point[],
  selected?: string,
): void {
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  const width = Math.max(1, Math.floor(canvas.clientWidth * ratio));
  const height = Math.max(1, Math.floor(canvas.clientHeight * ratio));
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
  const gl = canvas.getContext('webgl', {
    antialias: true,
    alpha: true,
    powerPreference: 'high-performance',
  });
  if (!gl) {
    return;
  }
  const program = shaderProgram(gl);
  gl.viewport(0, 0, width, height);
  gl.clearColor(0, 0, 0, 0);
  gl.clear(gl.COLOR_BUFFER_BIT);
  gl.useProgram(program);

  const pointMap = new Map(points.map(point => [point.id, point]));
  const edgeVertices = new Float32Array(graph.edges.flatMap(edge => {
    const source = pointMap.get(edge.source);
    const target = pointMap.get(edge.target);
    return source && target ? [source.x, source.y, target.x, target.y] : [];
  }));
  drawVertices(gl, program, edgeVertices, gl.LINES, [0.45, 0.47, 0.44, 0.24], 1);

  const normalPoints = new Float32Array(points
    .filter(point => point.id !== selected)
    .flatMap(point => [point.x, point.y]));
  drawVertices(gl, program, normalPoints, gl.POINTS, [0.20, 0.26, 0.22, 0.92], 6 * ratio);

  const selectedPoint = points.find(point => point.id === selected);
  if (selectedPoint) {
    drawVertices(
      gl,
      program,
      new Float32Array([selectedPoint.x, selectedPoint.y]),
      gl.POINTS,
      [0.05, 0.48, 0.32, 1],
      10 * ratio,
    );
  }
}

function shaderProgram(gl: WebGLRenderingContext): WebGLProgram {
  const existing = (gl.canvas as HTMLCanvasElement & { graphProgram?: WebGLProgram }).graphProgram;
  if (existing) {
    return existing;
  }
  const vertex = gl.createShader(gl.VERTEX_SHADER);
  const fragment = gl.createShader(gl.FRAGMENT_SHADER);
  if (!vertex || !fragment) {
    throw new Error('WebGL shader allocation failed');
  }
  gl.shaderSource(vertex, `
    attribute vec2 position;
    uniform float pointSize;
    void main() {
      gl_Position = vec4(position, 0.0, 1.0);
      gl_PointSize = pointSize;
    }
  `);
  gl.shaderSource(fragment, `
    precision mediump float;
    uniform vec4 color;
    void main() {
      if (gl_PointCoord.x > 0.0) {
        vec2 centered = gl_PointCoord - vec2(0.5);
        if (dot(centered, centered) > 0.25) discard;
      }
      gl_FragColor = color;
    }
  `);
  gl.compileShader(vertex);
  gl.compileShader(fragment);
  const program = gl.createProgram();
  if (!program) {
    throw new Error('WebGL program allocation failed');
  }
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.bindAttribLocation(program, 0, 'position');
  gl.linkProgram(program);
  (gl.canvas as HTMLCanvasElement & { graphProgram?: WebGLProgram }).graphProgram = program;
  return program;
}

function drawVertices(
  gl: WebGLRenderingContext,
  program: WebGLProgram,
  vertices: Float32Array,
  mode: number,
  color: [number, number, number, number],
  pointSize: number,
): void {
  if (!vertices.length) {
    return;
  }
  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STREAM_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  gl.uniform4fv(gl.getUniformLocation(program, 'color'), color);
  gl.uniform1f(gl.getUniformLocation(program, 'pointSize'), pointSize);
  gl.drawArrays(mode, 0, vertices.length / 2);
  gl.deleteBuffer(buffer);
}

function hitTest(
  canvas: HTMLCanvasElement,
  event: MouseEvent<HTMLCanvasElement>,
  points: Point[],
): string | undefined {
  const bounds = canvas.getBoundingClientRect();
  const x = ((event.clientX - bounds.left) / bounds.width) * 2 - 1;
  const y = -(((event.clientY - bounds.top) / bounds.height) * 2 - 1);
  return points
    .map(point => ({ id: point.id, distance: Math.hypot(point.x - x, point.y - y) }))
    .filter(point => point.distance < 0.045)
    .sort((left, right) => left.distance - right.distance)[0]?.id;
}
