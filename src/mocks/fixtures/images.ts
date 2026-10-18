// 镜像商城（MOCK-DATA §8.1 fixtures/images.ts；优云智算风格卡片；Vast.ai 展示 cuda/driver）
import type { InternalId } from '../../types/domain';

export interface ImageSpec {
  id: InternalId;
  name: string;
  registry: string;
  tag: string;
  framework: string;
  cuda_version: string;
  size_gb: number;
  is_official: boolean;
}

export const IMAGES: ImageSpec[] = [
  {
    id: 1 as InternalId,
    name: 'NVIDIA PyTorch',
    registry: 'nvcr.io/nvidia',
    tag: '24.09-py3',
    framework: 'PyTorch 2.5',
    cuda_version: '12.6',
    size_gb: 18.4,
    is_official: true,
  },
  {
    id: 2 as InternalId,
    name: 'NVIDIA TensorFlow',
    registry: 'nvcr.io/nvidia',
    tag: '24.09-tf2-py3',
    framework: 'TensorFlow 2.17',
    cuda_version: '12.6',
    size_gb: 15.2,
    is_official: true,
  },
  {
    id: 3 as InternalId,
    name: 'vLLM',
    registry: 'vllm',
    tag: 'v0.6.4.post1',
    framework: 'vLLM',
    cuda_version: '12.6',
    size_gb: 12.8,
    is_official: true,
  },
  {
    id: 4 as InternalId,
    name: 'SGLang',
    registry: 'lmsysorg',
    tag: 'sglang-v0.4.0-cu126',
    framework: 'SGLang',
    cuda_version: '12.6',
    size_gb: 11.6,
    is_official: true,
  },
  {
    id: 5 as InternalId,
    name: 'RunSun CUDA Base',
    registry: 'runsun.registry/gpu',
    tag: 'ubuntu22.04-cuda12.6',
    framework: 'CUDA',
    cuda_version: '12.6',
    size_gb: 6.3,
    is_official: true,
  },
  {
    id: 6 as InternalId,
    name: 'Jupyter DataScience',
    registry: 'jupyter',
    tag: 'datascience-notebook-latest',
    framework: 'Jupyter',
    cuda_version: '12.4',
    size_gb: 8.9,
    is_official: false,
  },
  {
    id: 7 as InternalId,
    name: 'ComfyUI',
    registry: 'community',
    tag: 'comfyui-cu126',
    framework: 'ComfyUI',
    cuda_version: '12.6',
    size_gb: 14.1,
    is_official: false,
  },
  {
    id: 8 as InternalId,
    name: 'CUDA 12.8 Base',
    registry: 'nvidia/cuda',
    tag: '12.8.0-devel-ubuntu22.04',
    framework: 'CUDA',
    cuda_version: '12.8',
    size_gb: 5.8,
    is_official: true,
  },
];

export const imageById = (id: number): ImageSpec | undefined =>
  IMAGES.find((i) => i.id === id);
export const OFFICIAL_IMAGES = IMAGES.filter((i) => i.is_official);
