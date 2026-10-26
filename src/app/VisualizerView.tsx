import { useMusicAppContext } from "./MusicAppContext";
import VisualizerScene from "./VisualizerScene";
import "../visualizer/visualizer.css";
export default function VisualizerView() {
  const { modal } = useMusicAppContext();
  return modal === "visualizer" ? <VisualizerScene /> : null;
}
