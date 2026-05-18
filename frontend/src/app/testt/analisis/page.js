import Link from 'next/link';
import { 
  BarChart3, 
  Heart, 
  GraduationCap, 
  ArrowRight
} from 'lucide-react';
import HeaderBar from '@/components/layout/HeaderBar';

export default function AnalysisPage() {
  const analysisOptions = [
    {
      id: 'ekonomi',
      title: 'Analisis Ekonomi',
      description: 'Analisis data ekonomi, pertumbuhan, dan indikator keuangan daerah',
      icon: BarChart3,
      stats: '15+ indikator',
      color: 'from-red-500 to-red-600',
      badgeColor: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
      path: '/analisis/ekonomi'
    },
    {
      id: 'pendidikan',
      title: 'Analisis Pendidikan',
      description: 'Analisis data pendidikan, sekolah, dan indikator literasi daerah',
      icon: GraduationCap,
      stats: '20+ dataset',
      color: 'from-yellow-500 to-yellow-600',
      badgeColor: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
      path: '/analisis/pendidikan'
    },
    {
      id: 'kesehatan',
      title: 'Analisis Kesehatan',
      description: 'Analisis data kesehatan, fasilitas, dan indikator kesehatan masyarakat',
      icon: Heart,
      stats: '12+ metrik',
      color: 'from-green-500 to-green-600',
      badgeColor: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
      path: '/analisis/kesehatan'
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 md:p-8">
      <HeaderBar />
      
      {/* Container untuk pusatkan card secara vertikal */}
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center">
        <div className="w-full max-w-6xl mx-auto">
          
          {/* Judul halaman di atas card */}
          <div className="text-center mb-10">
            <h1 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-3">
              Dashboard Analisis
            </h1>
            <p className="text-gray-600 dark:text-gray-300">
              Pilih kategori untuk melihat analisis data yang komprehensif
            </p>
          </div>
          
          {/* Cards Grid yang diatur di tengah */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 justify-items-center">
            {analysisOptions.map((option) => {
              const Icon = option.icon;
              return (
                <Link
                  key={option.id}
                  href={option.path}
                  className="group block w-full max-w-sm"
                >
                  <div className="h-full bg-white dark:bg-gray-800 rounded-2xl shadow-lg overflow-hidden transition-all duration-300 hover:shadow-2xl hover:-translate-y-2 border border-gray-200 dark:border-gray-700">
                    {/* Gradient Header */}
                    <div className={`relative p-6 bg-gradient-to-r ${option.color}`}>
                      <div className="flex items-center justify-between">
                        <div className="p-3 bg-white/20 dark:bg-white/10 backdrop-blur-sm rounded-xl">
                          <Icon className="h-8 w-8 text-white" />
                        </div>
                        <div className={`px-3 py-1 rounded-full text-sm font-medium ${option.badgeColor}`}>
                          {option.stats}
                        </div>
                      </div>
                      
                      <h2 className="mt-6 text-2xl font-bold text-white">{option.title}</h2>
                      
                      {/* Animated Arrow */}
                      <div className="absolute bottom-6 right-6 opacity-0 group-hover:opacity-100 transform group-hover:translate-x-0 translate-x-2 transition-all duration-300">
                        <ArrowRight className="h-8 w-8 text-white/90" />
                      </div>
                    </div>

                    {/* Card Body */}
                    <div className="p-6">
                      <p className="text-gray-600 dark:text-gray-300 mb-6">
                        {option.description}
                      </p>
                      
                      {/* Progress/Status */}
                      <div className="space-y-3">
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-500 dark:text-gray-400">Data update</span>
                          <span className="font-medium text-green-600 dark:text-green-400">Terbaru</span>
                        </div>
                        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                          <div 
                            className={`h-2 rounded-full bg-gradient-to-r ${option.color}`}
                            style={{ width: '100%' }}
                          ></div>
                        </div>
                      </div>
                    </div>

                    {/* Hover Border Effect */}
                    <div className="h-1 bg-gradient-to-r from-transparent via-white/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                  </div>
                </Link>
              );
            })}
          </div>
          
          {/* Teks footer di bawah card */}
          <div className="text-center mt-10">
            <p className="text-gray-500 dark:text-gray-400 text-sm">
              Pilih salah satu kategori untuk mulai menganalisis data
            </p>
          </div>
          
        </div>
      </div>
    </div>
  );
}