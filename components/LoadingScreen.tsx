import type { FC } from 'react';

type LoadingScreenProps = {
  message?: string;
};

const LoadingScreen: FC<LoadingScreenProps> = ({ message = 'データ読み込み中' }) => (
  <div className="min-h-screen bg-white flex items-center justify-center">
    <div className="text-center">
      <div className="w-10 h-10 rounded-full border-2 border-gray-200 border-t-gray-500 mx-auto mb-4 animate-spin" />
      <p className="text-gray-500">{message}</p>
    </div>
  </div>
);

export default LoadingScreen;
