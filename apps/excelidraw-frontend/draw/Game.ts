import { Tool } from "@/components/Canvas";
import { getExistingShapes } from "./http";

export type Shape = {
    type: "rect";
    x: number;
    y: number;
    width: number;
    height: number;
} | {
    type: "circle";
    centerX: number;
    centerY: number;
    radius: number;
} | {
    type: "pencil";
    points: { x: number; y: number }[];
}

function pencilPointsFromShape(shape: Shape & { type: "pencil" }): { x: number; y: number }[] {
    const s = shape as Shape & { type: "pencil" } & {
        startX?: number;
        startY?: number;
        endX?: number;
        endY?: number;
    };
    if (Array.isArray(s.points) && s.points.length > 0) {
        return s.points;
    }
    if (
        typeof s.startX === "number" &&
        typeof s.startY === "number" &&
        typeof s.endX === "number" &&
        typeof s.endY === "number"
    ) {
        return [
            { x: s.startX, y: s.startY },
            { x: s.endX, y: s.endY },
        ];
    }
    return [];
}

export class Game {

    private canvas: HTMLCanvasElement;
    private ctx: CanvasRenderingContext2D;
    private existingShapes: Shape[];
    private roomId: string;
    private clicked = false;
    private startX = 0;
    private startY = 0;
    private selectedTool: Tool = "circle";

    /** Viewport: screen = world * scale + pan */
    private panX = 0;
    private panY = 0;
    private scale = 1;

    private isPanning = false;
    private lastPanClientX = 0;
    private lastPanClientY = 0;
    /** Space held: left-drag pans (middle mouse also pans). */
    private spaceHeld = false;

    private pencilStroke: { x: number; y: number }[] = [];

    socket: WebSocket;

    constructor(canvas: HTMLCanvasElement, roomId: string, socket: WebSocket) {
        this.canvas = canvas;
        this.ctx = canvas.getContext("2d")!;
        this.existingShapes = [];
        this.roomId = roomId;
        this.socket = socket;
        this.init();
        this.initHandlers();
        this.initMouseHandlers();
    }

    destroy() {
        this.canvas.removeEventListener("mousedown", this.mouseDownHandler);
        this.canvas.removeEventListener("mouseup", this.mouseUpHandler);
        this.canvas.removeEventListener("mousemove", this.mouseMoveHandler);
        this.canvas.removeEventListener("mouseleave", this.mouseLeaveHandler);
        this.canvas.removeEventListener("wheel", this.wheelHandler);
        window.removeEventListener("mouseup", this.windowMouseUpHandler);
        window.removeEventListener("keydown", this.keyDownHandler);
        window.removeEventListener("keyup", this.keyUpHandler);
    }

    setTool(tool: "circle" | "pencil" | "rect") {
        this.selectedTool = tool;
    }

    async init() {
        this.existingShapes = await getExistingShapes(this.roomId);
        this.clearCanvas();
    }

    initHandlers() {
        this.socket.onmessage = (event) => {
            const message = JSON.parse(event.data);

            if (message.type == "chat") {
                const parsedShape = JSON.parse(message.message);
                this.existingShapes.push(parsedShape.shape);
                this.clearCanvas();
            }
        };
    }

    private getCanvasPixel(e: MouseEvent) {
        const r = this.canvas.getBoundingClientRect();
        return { x: e.clientX - r.left, y: e.clientY - r.top };
    }

    private screenToWorld(sx: number, sy: number) {
        return {
            x: (sx - this.panX) / this.scale,
            y: (sy - this.panY) / this.scale,
        };
    }

    private getWorldPoint(e: MouseEvent) {
        const p = this.getCanvasPixel(e);
        return this.screenToWorld(p.x, p.y);
    }

    private beginFrame() {
        this.ctx.setTransform(1, 0, 0, 1, 0, 0);
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.fillStyle = "rgba(0, 0, 0)";
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        this.ctx.setTransform(this.scale, 0, 0, this.scale, this.panX, this.panY);
        this.ctx.strokeStyle = "rgba(255, 255, 255)";
        this.ctx.lineJoin = "round";
        this.ctx.lineCap = "round";
    }

    private endFrame() {
        this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    }

    private drawPencilPath(points: { x: number; y: number }[]) {
        if (points.length < 2) {
            return;
        }
        this.ctx.beginPath();
        this.ctx.moveTo(points[0].x, points[0].y);
        for (let i = 1; i < points.length; i++) {
            this.ctx.lineTo(points[i].x, points[i].y);
        }
        this.ctx.stroke();
    }

    clearCanvas() {
        this.beginFrame();

        for (const shape of this.existingShapes) {
            if (shape.type === "rect") {
                this.ctx.strokeRect(shape.x, shape.y, shape.width, shape.height);
            } else if (shape.type === "circle") {
                this.ctx.beginPath();
                this.ctx.arc(shape.centerX, shape.centerY, Math.abs(shape.radius), 0, Math.PI * 2);
                this.ctx.stroke();
                this.ctx.closePath();
            } else if (shape.type === "pencil") {
                this.drawPencilPath(pencilPointsFromShape(shape));
            }
        }

        this.endFrame();
    }

    private appendPencilPoint(x: number, y: number) {
        const last = this.pencilStroke[this.pencilStroke.length - 1];
        if (last && last.x === x && last.y === y) {
            return;
        }
        if (last) {
            const dx = x - last.x;
            const dy = y - last.y;
            if (dx * dx + dy * dy < 1) {
                return;
            }
        }
        this.pencilStroke.push({ x, y });
    }

    mouseDownHandler = (e: MouseEvent) => {
        const startPan = e.button === 1 || (e.button === 0 && this.spaceHeld);
        if (startPan) {
            e.preventDefault();
            this.isPanning = true;
            this.lastPanClientX = e.clientX;
            this.lastPanClientY = e.clientY;
            return;
        }
        if (e.button !== 0) {
            return;
        }

        this.clicked = true;
        const w = this.getWorldPoint(e);
        this.startX = w.x;
        this.startY = w.y;

        if (this.selectedTool === "pencil") {
            this.pencilStroke = [{ x: w.x, y: w.y }];
        }
    };

    mouseUpHandler = (e: MouseEvent) => {
        if (e.button === 1) {
            this.isPanning = false;
            return;
        }
        if (e.button !== 0) {
            return;
        }

        if (!this.clicked) {
            return;
        }
        this.clicked = false;

        const end = this.getWorldPoint(e);
        const selectedTool = this.selectedTool;
        let shape: Shape | null = null;

        if (selectedTool === "rect") {
            shape = {
                type: "rect",
                x: Math.min(this.startX, end.x),
                y: Math.min(this.startY, end.y),
                width: Math.abs(end.x - this.startX),
                height: Math.abs(end.y - this.startY),
            };
        } else if (selectedTool === "circle") {
            const width = end.x - this.startX;
            const height = end.y - this.startY;
            const radius = Math.max(width, height) / 2;
            shape = {
                type: "circle",
                radius,
                centerX: this.startX + radius,
                centerY: this.startY + radius,
            };
        } else if (selectedTool === "pencil") {
            this.appendPencilPoint(end.x, end.y);
            if (this.pencilStroke.length < 2) {
                this.pencilStroke.push({ x: this.startX, y: this.startY });
            }
            shape = {
                type: "pencil",
                points: [...this.pencilStroke],
            };
            this.pencilStroke = [];
        }

        if (!shape) {
            this.clearCanvas();
            return;
        }

        this.existingShapes.push(shape);

        this.socket.send(JSON.stringify({
            type: "chat",
            message: JSON.stringify({
                shape,
            }),
            roomId: this.roomId,
        }));

        this.clearCanvas();
    };

    mouseMoveHandler = (e: MouseEvent) => {
        if (this.isPanning) {
            this.panX += e.clientX - this.lastPanClientX;
            this.panY += e.clientY - this.lastPanClientY;
            this.lastPanClientX = e.clientX;
            this.lastPanClientY = e.clientY;
            this.clearCanvas();
            return;
        }

        if (!this.clicked) {
            return;
        }

        const end = this.getWorldPoint(e);
        const width = end.x - this.startX;
        const height = end.y - this.startY;
        const selectedTool = this.selectedTool;

        this.beginFrame();

        for (const shape of this.existingShapes) {
            if (shape.type === "rect") {
                this.ctx.strokeRect(shape.x, shape.y, shape.width, shape.height);
            } else if (shape.type === "circle") {
                this.ctx.beginPath();
                this.ctx.arc(shape.centerX, shape.centerY, Math.abs(shape.radius), 0, Math.PI * 2);
                this.ctx.stroke();
                this.ctx.closePath();
            } else if (shape.type === "pencil") {
                this.drawPencilPath(pencilPointsFromShape(shape));
            }
        }

        if (selectedTool === "rect") {
            this.ctx.strokeRect(this.startX, this.startY, width, height);
        } else if (selectedTool === "circle") {
            const radius = Math.max(width, height) / 2;
            const centerX = this.startX + radius;
            const centerY = this.startY + radius;
            this.ctx.beginPath();
            this.ctx.arc(centerX, centerY, Math.abs(radius), 0, Math.PI * 2);
            this.ctx.stroke();
            this.ctx.closePath();
        } else if (selectedTool === "pencil") {
            this.appendPencilPoint(end.x, end.y);
            this.drawPencilPath(this.pencilStroke);
        }

        this.endFrame();
    };

    mouseLeaveHandler = () => {
        if (this.isPanning) {
            return;
        }
        if (this.clicked && this.selectedTool === "pencil") {
            return;
        }
        if (this.clicked) {
            this.clicked = false;
            this.pencilStroke = [];
            this.clearCanvas();
        }
    };

    wheelHandler = (e: WheelEvent) => {
        e.preventDefault();
        const canvasPt = this.getCanvasPixel(e);
        const wx = (canvasPt.x - this.panX) / this.scale;
        const wy = (canvasPt.y - this.panY) / this.scale;

        const factor = Math.exp(-e.deltaY * 0.001);
        const nextScale = Math.min(5, Math.max(0.1, this.scale * factor));

        this.panX = canvasPt.x - wx * nextScale;
        this.panY = canvasPt.y - wy * nextScale;
        this.scale = nextScale;

        this.clearCanvas();
    };

    windowMouseUpHandler = () => {
        this.isPanning = false;
    };

    keyDownHandler = (e: KeyboardEvent) => {
        if (e.code !== "Space" || e.repeat) {
            return;
        }
        const t = e.target as HTMLElement | null;
        if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) {
            return;
        }
        e.preventDefault();
        this.spaceHeld = true;
    };

    keyUpHandler = (e: KeyboardEvent) => {
        if (e.code === "Space") {
            this.spaceHeld = false;
        }
    };

    initMouseHandlers() {
        this.canvas.addEventListener("mousedown", this.mouseDownHandler);
        this.canvas.addEventListener("mouseup", this.mouseUpHandler);
        this.canvas.addEventListener("mousemove", this.mouseMoveHandler);
        this.canvas.addEventListener("mouseleave", this.mouseLeaveHandler);
        this.canvas.addEventListener("wheel", this.wheelHandler, { passive: false });
        window.addEventListener("mouseup", this.windowMouseUpHandler);
        window.addEventListener("keydown", this.keyDownHandler);
        window.addEventListener("keyup", this.keyUpHandler);
    }
}
