import { usePlayerContext } from "./PlayerContext";
import VisualizerScene from "./VisualizerScene";
import "../visualizer/visualizer.css";
export default function VisualizerView() {
  const { modal } = usePlayerContext();
  return modal === "visualizer" ? <VisualizerScene /> : null;
}
