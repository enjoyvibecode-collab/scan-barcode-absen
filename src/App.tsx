/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { LayoutDashboard, Users, QrCode, Scan, Camera, Trash2, Edit, Plus, Eye, X, Download, History, CheckCircle, AlertCircle, RefreshCw, FileDown, Shield, ShieldOff, Filter, Search, TrendingUp, UserCheck, UserPlus } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { QRCodeCanvas } from 'qrcode.react';
import { Html5Qrcode } from 'html5-qrcode';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie } from 'recharts';

type Page = 'dashboard' | 'siswa' | 'scan' | 'riwayat';

interface Student {
  id: string;
  nama: string;
  kelas: string;
  qrData: string;
}

interface Attendance {
  id: string;
  studentId: string;
  nama: string;
  kelas: string;
  waktu: string;
  tanggal: string;
}

export default function App() {
  const [currentPage, setCurrentPage] = useState<Page>('dashboard');

  // Student State
  const [students, setStudents] = useState<Student[]>([]);
  const [newNama, setNewNama] = useState('');
  const [newKelas, setNewKelas] = useState('');
  
  // Attendance State
  const [attendances, setAttendances] = useState<Attendance[]>([]);
  
  // Filter & Admin State
  const [isAdmin, setIsAdmin] = useState(false);
  const [filterKelas, setFilterKelas] = useState('Semua');
  const [filterDate, setFilterDate] = useState('');
  
  // Scanner State
  const [isScanning, setIsScanning] = useState(false);
  const [lastScan, setLastScan] = useState<{ 
    nama: string; 
    kelas: string; 
    status: 'success' | 'duplicate' | 'error'; 
    message: string;
    raw: string; 
    time: string;
  } | null>(null);
  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);

  // Modal State
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);

  // Load from localStorage on mount
  useEffect(() => {
    const savedStudents = localStorage.getItem('qr_absensi_students');
    const savedAttendances = localStorage.getItem('qr_absensi_history');
    
    if (savedStudents) {
      try {
        setStudents(JSON.parse(savedStudents));
      } catch (e) {
        console.error("Failed to parse students", e);
      }
    }
    
    if (savedAttendances) {
      try {
        setAttendances(JSON.parse(savedAttendances));
      } catch (e) {
        console.error("Failed to parse attendances", e);
      }
    }
  }, []);

  // Save to localStorage on change
  useEffect(() => {
    localStorage.setItem('qr_absensi_students', JSON.stringify(students));
  }, [students]);

  useEffect(() => {
    localStorage.setItem('qr_absensi_history', JSON.stringify(attendances));
  }, [attendances]);

  // Helper for current date string (YYYY-MM-DD)
  const getTodayDate = () => new Date().toISOString().split('T')[0];

  // Handle Scanner Lifecycle
  useEffect(() => {
    if (currentPage === 'scan' && isScanning) {
      const startScanner = async () => {
        try {
          const html5QrCode = new Html5Qrcode("reader");
          html5QrCodeRef.current = html5QrCode;
          const config = { fps: 10, qrbox: { width: 250, height: 250 } };

          await html5QrCode.start(
            { facingMode: "environment" },
            config,
            (decodedText) => {
              processAttendance(decodedText);
            },
            () => {} // error callback
          );
        } catch (err) {
          console.error("Scanner start error", err);
          setIsScanning(false);
        }
      };

      startScanner();

      return () => {
        if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning) {
          html5QrCodeRef.current.stop().then(() => {
            html5QrCodeRef.current?.clear();
          }).catch(console.error);
        }
      };
    } else {
      if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning) {
        html5QrCodeRef.current.stop().then(() => {
           html5QrCodeRef.current?.clear();
           html5QrCodeRef.current = null;
        }).catch(console.error);
      }
    }
  }, [currentPage, isScanning]);

  const processAttendance = (decodedText: string) => {
    const student = students.find(s => s.qrData === decodedText);
    const today = getTodayDate();
    const nowTime = new Date().toLocaleTimeString('id-ID');

    const playBeep = (type: 'success' | 'error') => {
      try {
        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(type === 'success' ? 880 : 330, audioCtx.currentTime);
        gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.2);
        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        oscillator.start();
        oscillator.stop(audioCtx.currentTime + 0.2);
      } catch (e) {
        console.warn("Audio beep failed", e);
      }
    };

    if (!student) {
      playBeep('error');
      if (navigator.vibrate) navigator.vibrate(200);
      setLastScan({ 
        nama: 'Unknown',
        kelas: 'Unknown',
        status: 'error', 
        message: 'QR Code tidak terdaftar',
        raw: decodedText,
        time: nowTime
      });
      return;
    }

    // Check if duplicate today
    const alreadyAttended = attendances.find(a => a.studentId === student.id && a.tanggal === today);
    
    if (alreadyAttended) {
      playBeep('error');
      if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
      setLastScan({ 
        nama: student.nama,
        kelas: student.kelas,
        status: 'duplicate', 
        message: 'Sudah absen hari ini',
        raw: decodedText,
        time: nowTime
      });
      return;
    }

    // Record attendance
    playBeep('success');
    if (navigator.vibrate) navigator.vibrate(50);
    const newAttendance: Attendance = {
      id: Date.now().toString(),
      studentId: student.id,
      nama: student.nama,
      kelas: student.kelas,
      waktu: nowTime,
      tanggal: today
    };

    setAttendances(prev => [...prev, newAttendance]);
    setLastScan({ 
      nama: student.nama,
      kelas: student.kelas,
      status: 'success', 
      message: 'Absensi Berhasil!', 
      raw: decodedText,
      time: nowTime
    });
  };

  const handleAddStudent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNama || !newKelas) return;

    const timestamp = Date.now().toString();
    const newStudent: Student = {
      id: timestamp,
      nama: newNama,
      kelas: newKelas,
      qrData: `ABSENSI-${newNama.replace(/\s+/g, '-').toUpperCase()}-${newKelas.replace(/\s+/g, '-').toUpperCase()}-${timestamp}`
    };

    setStudents([...students, newStudent]);
    setNewNama('');
    setNewKelas('');
  };

  const handleDeleteStudent = (id: string) => {
    if (confirm('Apakah Anda yakin ingin menghapus data siswa ini? Semua riwayat terkait juga akan hilang.')) {
      setStudents(students.filter(s => s.id !== id));
      setAttendances(attendances.filter(a => a.studentId !== id));
    }
  };

  const handleDownloadQR = (id: string, nama: string) => {
    const canvas = document.getElementById(id) as HTMLCanvasElement;
    if (canvas) {
      const url = canvas.toDataURL("image/png");
      const link = document.createElement("a");
      link.download = `QR-${nama}.png`;
      link.href = url;
      link.click();
    }
  };

  const handleExportCSV = () => {
    if (filteredAttendances.length === 0) return alert("Tidak ada data untuk diekspor");
    
    // Create CSV content manually for simplicity
    const headers = ["Nama", "Kelas", "Tanggal", "Waktu"];
    const rows = filteredAttendances.map(a => [a.nama, a.kelas, a.tanggal, a.waktu]);
    
    let csvContent = headers.join(",") + "\n"
      + rows.map(e => e.join(",")).join("\n");

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Data_Absensi_${filterDate || 'Semua'}_${new Date().toLocaleDateString()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleResetAttendance = () => {
    if (confirm('APAKAH ANDA YAKIN? Semua data riwayat absensi akan dihapus permanen.')) {
      setAttendances([]);
      alert('Data absensi berhasil dikosongkan.');
    }
  };

  // Stats derived from state
  const todayDate = getTodayDate();
  const attendancesToday = attendances.filter(a => a.tanggal === todayDate);
  const stats = {
    totalSiswa: students.length,
    hadirHariIni: attendancesToday.length,
  };

  // Get unique classes for filter
  const uniqueClasses = ['Semua', ...new Set(students.map(s => s.kelas))].sort();

  // Filtered attendances based on UI filters
  const filteredAttendances = attendances.filter(a => {
    const matchKelas = filterKelas === 'Semua' || a.kelas === filterKelas;
    const matchDate = !filterDate || a.tanggal === filterDate;
    return matchKelas && matchDate;
  }).reverse();

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'siswa', label: 'Data Siswa', icon: Users },
    { id: 'scan', label: 'Scan Absensi', icon: QrCode },
    { id: 'riwayat', label: 'Riwayat', icon: History },
  ];

  // Dashboard Chart Data
  const getChartData = () => {
    // Get last 7 days of attendance
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      return d.toISOString().split('T')[0];
    });

    return last7Days.map(date => {
      const count = attendances.filter(a => a.tanggal === date).length;
      const dayName = new Date(date).toLocaleDateString('id-ID', { weekday: 'short' });
      return { name: dayName, hadir: count, date };
    });
  };

  const chartData = getChartData();

  function CountUp({ end, duration = 1000 }: { end: number, duration?: number }) {
    const [count, setCount] = useState(0);
    useEffect(() => {
      let startTimestamp: number | null = null;
      const step = (timestamp: number) => {
        if (!startTimestamp) startTimestamp = timestamp;
        const progress = Math.min((timestamp - startTimestamp) / duration, 1);
        setCount(Math.floor(progress * end));
        if (progress < 1) {
          window.requestAnimationFrame(step);
        }
      };
      window.requestAnimationFrame(step);
    }, [end, duration]);
    return <>{count}</>;
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-blue-50 via-gray-50 to-purple-50 flex flex-col font-sans text-gray-900 transition-colors">
      {/* Navigation Bar */}
      <nav className="bg-blue-600 text-white shadow-lg sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-2">
              <div className="bg-white/20 p-1.5 rounded-xl backdrop-blur-md">
                <QrCode className="w-8 h-8 text-white" />
              </div>
              <span className="font-black text-xl tracking-tighter hidden sm:inline uppercase">Absensi QR</span>
            </div>
            
            <div className="flex items-center space-x-1 sm:space-x-4">
              <div className="hidden md:flex space-x-1">
                {navItems.map((item) => (
                  <motion.button
                    key={item.id}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => {
                      setCurrentPage(item.id as Page);
                      if (item.id !== 'scan') setIsScanning(false);
                    }}
                    className={`flex items-center space-x-2 px-4 py-2 rounded-xl transition-all duration-300 ${
                      currentPage === item.id 
                        ? 'bg-white text-blue-600 shadow-[0_8px_30px_rgb(0,0,0,0.12)] font-bold' 
                        : 'hover:bg-white/10 text-blue-50'
                    }`}
                  >
                    <item.icon className="w-4 h-4" />
                    <span className="font-semibold text-xs sm:text-sm">{item.label}</span>
                  </motion.button>
                ))}
              </div>

              <div className="h-6 w-[1px] bg-white/20 mx-2 hidden md:block"></div>

              <motion.button 
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setIsAdmin(!isAdmin)}
                className={`flex items-center space-x-1 px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all border backdrop-blur-md ${
                  isAdmin 
                    ? 'bg-amber-400 border-amber-300 text-amber-900 shadow-lg shadow-amber-200/50' 
                    : 'bg-white/10 border-white/20 text-white'
                }`}
              >
                {isAdmin ? <Shield className="w-4 h-4" /> : <ShieldOff className="w-4 h-4" />}
                <span className="hidden xs:inline ml-1">{isAdmin ? 'Admin Root' : 'User Access'}</span>
              </motion.button>
            </div>
          </div>
        </div>
        {/* Mobile Nav */}
        <div className="md:hidden bg-blue-700 flex justify-around py-2 border-t border-blue-500 overflow-x-auto">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => {
                setCurrentPage(item.id as Page);
                if (item.id !== 'scan') setIsScanning(false);
              }}
              className={`flex flex-col items-center px-3 min-w-[60px] ${
                currentPage === item.id ? 'text-white' : 'text-blue-300 opacity-60'
              }`}
            >
              <item.icon className="w-4 h-4" />
              <span className="text-[9px] uppercase font-bold mt-1 tracking-tighter">{item.label}</span>
            </button>
          ))}
        </div>
      </nav>

      {/* Main Content */}
      <main className="flex-grow max-w-7xl mx-auto w-full p-4 md:p-8">
        <AnimatePresence mode="wait">
          {currentPage === 'dashboard' && (
            <motion.div
              key="dashboard"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-8"
            >
              <header>
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                  <motion.div
                    initial={{ x: -20, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                  >
                    <h1 className="text-4xl font-black text-gray-900 tracking-tighter bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-purple-600">
                      SISTEM ABSENSI QR
                    </h1>
                    <p className="text-gray-500 mt-2 text-lg font-medium">Monitoring kehadiran siswa secara real-time.</p>
                  </motion.div>
                  <motion.div 
                    initial={{ x: 20, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    className="bg-white/80 backdrop-blur-md px-6 py-3 rounded-2xl shadow-xl shadow-blue-100/50 border border-white flex items-center space-x-4 text-sm text-gray-600 font-bold"
                  >
                    <div className="bg-blue-50 p-2 rounded-lg">
                      <History className="w-5 h-5 text-blue-600" />
                    </div>
                    <span>{new Date().toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
                  </motion.div>
                </div>
              </header>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                <motion.div 
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.1 }}
                  className="bg-white p-8 rounded-3xl shadow-[0_20px_50px_rgba(8,_112,_184,_0.07)] border border-white/50 flex items-center space-x-6 relative overflow-hidden group"
                >
                  <div className="absolute top-0 right-0 p-8 opacity-5 transform group-hover:scale-110 transition-transform">
                    <Users className="w-24 h-24" />
                  </div>
                  <div className="bg-blue-600 p-5 rounded-2xl shadow-lg shadow-blue-200">
                    <Users className="text-white w-8 h-8" />
                  </div>
                  <div>
                    <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-1">Total Siswa</p>
                    <p className="text-4xl font-black text-gray-900"><CountUp end={stats.totalSiswa} /></p>
                  </div>
                </motion.div>

                <motion.div 
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.2 }}
                  className="bg-white p-8 rounded-3xl shadow-[0_20px_50px_rgba(8,_112,_184,_0.07)] border border-white/50 flex items-center space-x-6 relative overflow-hidden group"
                >
                  <div className="absolute top-0 right-0 p-8 opacity-5 transform group-hover:scale-110 transition-transform">
                    <UserCheck className="w-24 h-24" />
                  </div>
                  <div className="bg-green-500 p-5 rounded-2xl shadow-lg shadow-green-200">
                    <UserCheck className="text-white w-8 h-8" />
                  </div>
                  <div>
                    <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-1">Hadir Hari Ini</p>
                    <p className="text-4xl font-black text-gray-900"><CountUp end={stats.hadirHariIni} /></p>
                  </div>
                </motion.div>
                
                <motion.div 
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.3 }}
                  className="bg-white p-8 rounded-3xl shadow-[0_20px_50px_rgba(8,_112,_184,_0.07)] border border-white/50 flex items-center space-x-6 relative overflow-hidden group"
                >
                  <div className="absolute top-0 right-0 p-8 opacity-5 transform group-hover:scale-110 transition-transform">
                    <TrendingUp className="w-24 h-24" />
                  </div>
                  <div className="bg-purple-600 p-5 rounded-2xl shadow-lg shadow-purple-200">
                    <TrendingUp className="text-white w-8 h-8" />
                  </div>
                  <div>
                    <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-1">Presentase</p>
                    <p className="text-4xl font-black text-gray-900">
                      {stats.totalSiswa > 0 ? (stats.hadirHariIni / stats.totalSiswa * 100).toFixed(0) : 0}%
                    </p>
                  </div>
                </motion.div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <motion.div 
                   initial={{ opacity: 0, y: 20 }}
                   animate={{ opacity: 1, y: 0 }}
                   transition={{ delay: 0.4 }}
                   className="bg-white p-8 rounded-3xl shadow-[0_20px_50px_rgba(8,_112,_184,_0.07)] border border-white/50"
                >
                  <h3 className="text-xl font-black text-gray-900 mb-8 flex items-center space-x-3">
                    <div className="w-1 h-6 bg-blue-600 rounded-full"></div>
                    <span>Tren Kehadiran (7 Hari Terakhir)</span>
                  </h3>
                  <div className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                        <XAxis 
                          dataKey="name" 
                          axisLine={false} 
                          tickLine={false} 
                          tick={{ fontSize: 12, fontWeight: 700, fill: '#9ca3af' }}
                          dy={10}
                        />
                        <YAxis hide />
                        <Tooltip 
                          cursor={{ fill: 'transparent' }}
                          content={({ active, payload }) => {
                            if (active && payload && payload.length) {
                              return (
                                <div className="bg-gray-900 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-xl border border-gray-800">
                                  {payload[0].value} Siswa Hadir
                                </div>
                              );
                            }
                            return null;
                          }}
                        />
                        <Bar dataKey="hadir" radius={[10, 10, 10, 10]} barSize={40}>
                          {chartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={index === chartData.length - 1 ? '#2563eb' : '#e5e7eb'} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </motion.div>

                <motion.div 
                   initial={{ opacity: 0, y: 20 }}
                   animate={{ opacity: 1, y: 0 }}
                   transition={{ delay: 0.5 }}
                   className="bg-white p-8 rounded-3xl shadow-[0_20px_50px_rgba(8,_112,_184,_0.07)] border border-white/50"
                >
                   <h3 className="text-xl font-black text-gray-900 mb-8 flex items-center space-x-3">
                    <div className="w-1 h-6 bg-purple-600 rounded-full"></div>
                    <span>Aksi Cepat</span>
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <motion.button 
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => setCurrentPage('scan')}
                      className="bg-gradient-to-br from-blue-600 to-blue-700 p-6 rounded-3xl text-white text-left shadow-xl shadow-blue-100 flex flex-col justify-between h-[160px]"
                    >
                      <QrCode className="w-10 h-10 opacity-50" />
                      <div>
                        <p className="font-black uppercase tracking-widest text-[10px] text-blue-100">Lakukan Absensi</p>
                        <p className="font-bold text-lg leading-tight">Mulai Scanner</p>
                      </div>
                    </motion.button>

                    <motion.button 
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => setCurrentPage('siswa')}
                      className="bg-white border-2 border-gray-100 p-6 rounded-3xl text-gray-900 text-left shadow-xl shadow-gray-50 flex flex-col justify-between h-[160px]"
                    >
                      <UserPlus className="w-10 h-10 text-blue-600 opacity-20" />
                      <div>
                        <p className="font-black uppercase tracking-widest text-[10px] text-gray-400">Database Siswa</p>
                        <p className="font-bold text-lg leading-tight">Data & QR Code</p>
                      </div>
                    </motion.button>
                  </div>
                </motion.div>
              </div>
            </motion.div>
          )}

          {currentPage === 'siswa' && (
            <motion.div
              key="siswa"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-8"
            >
              <motion.div 
                initial={{ scale: 0.95 }}
                animate={{ scale: 1 }}
                className="bg-white/80 backdrop-blur-xl p-8 rounded-[2rem] shadow-[0_20px_50px_rgba(0,0,0,0.05)] border border-white"
              >
                <h3 className="text-xl font-black text-gray-900 mb-6 flex items-center space-x-3">
                  <div className="bg-blue-100 p-2 rounded-lg">
                    <UserPlus className="w-5 h-5 text-blue-600" />
                  </div>
                  <span>Registrasi Siswa Baru</span>
                </h3>
                <form onSubmit={handleAddStudent} className="flex flex-col md:flex-row gap-6">
                  <div className="flex-1">
                    <label className="block text-[10px] font-black text-gray-400 uppercase mb-2 tracking-widest">Nama Lengkap</label>
                    <input
                      type="text"
                      className="w-full px-5 py-3 rounded-2xl border border-gray-100 bg-gray-50/50 focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all font-bold text-gray-700"
                      placeholder="Masukkan nama..."
                      value={newNama}
                      onChange={(e) => setNewNama(e.target.value)}
                    />
                  </div>
                  <div className="flex-1">
                    <label className="block text-[10px] font-black text-gray-400 uppercase mb-2 tracking-widest">Kelas</label>
                    <input
                      type="text"
                      className="w-full px-5 py-3 rounded-2xl border border-gray-100 bg-gray-50/50 focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all font-bold text-gray-700"
                      placeholder="Masukkan kelas..."
                      value={newKelas}
                      onChange={(e) => setNewKelas(e.target.value)}
                    />
                  </div>
                  <div className="flex items-end">
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      type="submit"
                      disabled={!newNama || !newKelas}
                      className="w-full md:w-auto bg-blue-600 hover:bg-blue-700 disabled:bg-gray-200 text-white px-8 py-3 rounded-2xl font-black transition-all shadow-xl shadow-blue-200 flex items-center justify-center space-x-3 h-[52px]"
                    >
                      <Plus className="w-5 h-5" />
                      <span>TAMBAH</span>
                    </motion.button>
                  </div>
                </form>
              </motion.div>

              <div className="bg-white/70 backdrop-blur-md rounded-[2.5rem] shadow-[0_30px_60px_rgba(0,0,0,0.05)] border border-white overflow-hidden">
                <div className="p-8 border-b border-gray-100/50 flex justify-between items-center">
                  <h2 className="text-2xl font-black text-gray-900 tracking-tighter">Database Siswa</h2>
                  <div className="bg-blue-50 text-blue-600 px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-widest">
                    {students.length} Siswa
                  </div>
                </div>

                <div className="overflow-x-auto min-h-[300px]">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-gray-50/50 text-gray-400 uppercase text-[10px] font-black tracking-[0.2em]">
                        <th className="px-8 py-5 border-b border-gray-100/50">Profil Siswa</th>
                        <th className="px-8 py-5 border-b border-gray-100/50">Kelas</th>
                        <th className="px-8 py-5 border-b border-gray-100/50">Identitas QR</th>
                        <th className="px-8 py-5 border-b border-gray-100/50 text-right">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50/50">
                      {students.length > 0 ? (
                        students.map((student, idx) => (
                          <motion.tr 
                            layout
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: idx * 0.05 }}
                            key={student.id} 
                            className="group hover:bg-blue-50/30 transition-all"
                          >
                            <td className="px-8 py-6">
                              <div className="flex items-center space-x-4">
                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-100 to-purple-100 flex items-center justify-center font-black text-blue-600 text-xs">
                                  {student.nama.charAt(0).toUpperCase()}
                                </div>
                                <span className="font-bold text-gray-900">{student.nama}</span>
                              </div>
                            </td>
                            <td className="px-8 py-6">
                              <span className="bg-gray-100 text-gray-500 px-3 py-1 rounded-lg text-[10px] font-black font-mono">
                                {student.kelas}
                              </span>
                            </td>
                            <td className="px-8 py-6">
                              <div className="bg-white p-1 rounded-xl shadow-sm border border-gray-100 w-fit group-hover:scale-110 transition-transform">
                                <QRCodeCanvas 
                                  value={student.qrData} 
                                  size={44} 
                                  level="M"
                                />
                              </div>
                            </td>
                            <td className="px-8 py-6 text-right">
                              <div className="flex justify-end space-x-3 opacity-0 group-hover:opacity-100 transition-opacity">
                                <motion.button 
                                  whileHover={{ scale: 1.1 }}
                                  whileTap={{ scale: 0.9 }}
                                  onClick={() => setSelectedStudent(student)}
                                  className="text-blue-600 bg-blue-50 p-2.5 rounded-xl hover:bg-blue-600 hover:text-white transition-all shadow-sm"
                                  title="Lihat Detail"
                                >
                                  <Eye className="w-4 h-4" />
                                </motion.button>
                                {isAdmin && (
                                  <motion.button 
                                    whileHover={{ scale: 1.1 }}
                                    whileTap={{ scale: 0.9 }}
                                    onClick={() => handleDeleteStudent(student.id)}
                                    className="text-red-500 bg-red-50 p-2.5 rounded-xl hover:bg-red-500 hover:text-white transition-all shadow-sm"
                                    title="Hapus"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </motion.button>
                                )}
                              </div>
                            </td>
                          </motion.tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={4} className="px-8 py-24 text-center">
                            <div className="flex flex-col items-center space-y-4 opacity-20">
                              <Users className="w-20 h-20" />
                              <p className="font-black uppercase tracking-widest text-xs">Belum ada siswa terdaftar</p>
                            </div>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </motion.div>
          )}

          {currentPage === 'scan' && (
            <motion.div
              key="scan"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-6"
            >
              <div className="bg-white rounded-3xl shadow-xl overflow-hidden border border-gray-100">
                <div className="p-6 space-y-6 text-center">
                  <header className="space-y-1">
                    <h2 className="text-2xl font-bold text-gray-900">Scanner Absensi</h2>
                    <p className="text-sm text-gray-500">
                      {isScanning ? 'Kamera aktif, siap memindai...' : 'Kamera nonaktif'}
                    </p>
                  </header>

                  <div id="scanner-wrapper" className="relative mx-auto w-full max-w-sm aspect-square bg-gray-900 rounded-[2.5rem] flex items-center justify-center overflow-hidden border-8 border-white shadow-2xl">
                    {!isScanning ? (
                      <div className="flex flex-col items-center space-y-4">
                        <motion.div 
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className="bg-white/5 p-8 rounded-full backdrop-blur-md"
                        >
                          <Camera className="w-16 h-16 text-white" />
                        </motion.div>
                        <motion.button 
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => setIsScanning(true)}
                          className="bg-white text-gray-900 px-8 py-3 rounded-2xl font-black transition-all flex items-center space-x-3 shadow-xl"
                        >
                          <Camera className="w-6 h-6" />
                          <span>START SCANNER</span>
                        </motion.button>
                      </div>
                    ) : (
                      <div id="reader" className="w-full h-full scale-[1.01]"></div>
                    )}
                    
                    <AnimatePresence>
                      {isScanning && (
                        <>
                          <div className="absolute inset-0 pointer-events-none border-[60px] border-black/50 backdrop-blur-[1px]"></div>
                          
                          {/* Corner Frames */}
                          <div className="absolute top-[60px] left-[60px] w-12 h-12 border-t-4 border-l-4 border-white rounded-tl-2xl opacity-80"></div>
                          <div className="absolute top-[60px] right-[60px] w-12 h-12 border-t-4 border-r-4 border-white rounded-tr-2xl opacity-80"></div>
                          <div className="absolute bottom-[60px] left-[60px] w-12 h-12 border-b-4 border-l-4 border-white rounded-bl-2xl opacity-80"></div>
                          <div className="absolute bottom-[60px] right-[60px] w-12 h-12 border-b-4 border-r-4 border-white rounded-br-2xl opacity-80"></div>
                          
                          {/* Laser line */}
                          <motion.div 
                            initial={{ top: '60px' }}
                            animate={{ top: ['60px', '280px', '60px'] }}
                            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                            className="absolute left-[60px] right-[60px] h-[4px] bg-gradient-to-r from-transparent via-blue-400 to-transparent shadow-[0_0_20px_rgba(96,165,250,1)] pointer-events-none z-10"
                          />
                        </>
                      )}
                    </AnimatePresence>
                  </div>

                  {isScanning && (
                    <button 
                      onClick={() => setIsScanning(false)}
                      className="text-gray-500 hover:text-gray-700 text-sm font-bold flex items-center justify-center space-x-2 mx-auto"
                    >
                      <X className="w-4 h-4" />
                      <span>Berhenti</span>
                    </button>
                  )}
                </div>
              </div>

              <div className="space-y-6">
                <div className="bg-white rounded-3xl shadow-xl p-8 border border-gray-100 flex flex-col justify-center min-h-[300px]">
                  <h3 className="text-lg font-bold text-gray-900 mb-6 flex items-center space-x-2">
                    <RefreshCw className={`w-5 h-5 text-blue-500 ${isScanning ? 'animate-spin' : ''}`} />
                    <span>Hasil Scan Terakhir</span>
                  </h3>

                  {lastScan ? (
                    <motion.div 
                      key={lastScan.time}
                      initial={{ scale: 0.95, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      className={`p-6 rounded-2xl border-2 ${
                        lastScan.status === 'success' ? 'border-green-100 bg-green-50/30' : 
                        lastScan.status === 'duplicate' ? 'border-amber-100 bg-amber-50/30' : 'border-red-100 bg-red-50/30'
                      }`}
                    >
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center space-x-3">
                          {lastScan.status === 'success' ? (
                            <CheckCircle className="w-10 h-10 text-green-500" />
                          ) : (
                            <AlertCircle className="w-10 h-10 text-red-500" />
                          )}
                          <div>
                            <p className="text-xs font-bold uppercase tracking-widest text-gray-400">Status</p>
                            <p className={`text-sm font-bold ${
                              lastScan.status === 'success' ? 'text-green-600' : 
                              lastScan.status === 'duplicate' ? 'text-amber-600' : 'text-red-600'
                            }`}>
                              {lastScan.status === 'success' ? 'ABSENSI BERHASIL' : 
                               lastScan.status === 'duplicate' ? 'SUDAH ABSEN' : 'GAGAL'}
                            </p>
                          </div>
                        </div>
                        <span className="text-[10px] bg-gray-100 text-gray-500 px-2 py-1 rounded font-mono text-nowrap">{lastScan.time}</span>
                      </div>

                      <div className="space-y-3">
                         <div>
                            <p className="text-xs font-bold text-gray-400 uppercase">Nama Siswa</p>
                            <p className="font-bold text-gray-900 text-lg">{lastScan.nama}</p>
                          </div>
                          <div>
                            <p className="text-xs font-bold text-gray-400 uppercase">Kelas</p>
                            <p className="font-medium text-gray-700">{lastScan.kelas}</p>
                          </div>
                        
                        {lastScan.status === 'error' && (
                          <div className="bg-white p-4 rounded-xl border border-red-50">
                            <p className="text-xs text-gray-400 mb-1">QR Code Data:</p>
                            <p className="text-xs font-mono text-gray-600 break-all">{lastScan.raw}</p>
                            <p className="text-sm text-red-500 mt-2 font-medium">QR tidak terdaftar di sistem.</p>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  ) : (
                    <div className="flex flex-col items-center justify-center space-y-4 py-12 text-gray-400">
                      <QrCode className="w-16 h-16 opacity-20" />
                      <p className="text-sm italic text-center">Arahkan QR Code siswa ke kamera untuk memindai</p>
                    </div>
                  )}
                </div>

                <div className="bg-blue-600 text-white rounded-3xl p-6 shadow-lg shadow-blue-100">
                  <h4 className="font-bold mb-2 flex items-center space-x-2">
                    <AlertCircle className="w-4 h-4" />
                    <span>Petunjuk Scan</span>
                  </h4>
                  <ul className="text-xs text-blue-100 space-y-2 list-disc list-inside">
                    <li>Posisikan QR code tepat di tengah kotak kamera</li>
                    <li>Pastikan pencahayaan cukup dan gambar fokus</li>
                    <li>Siswa terdaftar akan otomatis divalidasi</li>
                  </ul>
                </div>
              </div>
            </motion.div>
          )}

          {currentPage === 'riwayat' && (
            <motion.div
              key="riwayat"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-8"
            >
              {/* Filter Area */}
              <div className="bg-white/80 backdrop-blur-xl p-8 rounded-[2.5rem] shadow-[0_20px_50px_rgba(0,0,0,0.05)] border border-white grid grid-cols-1 md:grid-cols-3 gap-8 items-end">
                <div>
                  <label className="block text-[10px] font-black text-gray-400 uppercase mb-3 tracking-[0.2em]">Filter Tanggal</label>
                  <input 
                    type="date" 
                    value={filterDate}
                    onChange={(e) => setFilterDate(e.target.value)}
                    className="w-full px-5 py-3 rounded-2xl border border-gray-100 bg-gray-50/50 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm font-bold text-gray-700"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-gray-400 uppercase mb-3 tracking-[0.2em]">Filter Kelas</label>
                  <select 
                    value={filterKelas}
                    onChange={(e) => setFilterKelas(e.target.value)}
                    className="w-full px-5 py-3 rounded-2xl border border-gray-100 bg-gray-50/50 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm font-bold text-gray-700 h-[52px]"
                  >
                    {uniqueClasses.map(k => <option key={k} value={k}>{k}</option>)}
                  </select>
                </div>
                <div className="flex space-x-3">
                  <motion.button 
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={handleExportCSV}
                    className="flex-1 bg-gradient-to-r from-green-500 to-green-600 text-white px-6 py-3 rounded-2xl font-black flex items-center justify-center space-x-3 shadow-xl shadow-green-100 transition-all h-[52px]"
                  >
                    <FileDown className="w-5 h-5" />
                    <span className="text-sm">DOWNLOAD CSV</span>
                  </motion.button>
                  {isAdmin && (
                    <motion.button 
                      whileHover={{ scale: 1.05, backgroundColor: '#ef4444', color: '#fff' }}
                      whileTap={{ scale: 0.95 }}
                      onClick={handleResetAttendance}
                      className="bg-red-50 text-red-500 p-3.5 rounded-2xl transition-all border border-red-100 h-[52px] shadow-sm"
                      title="Reset Data"
                    >
                      <Trash2 className="w-6 h-6" />
                    </motion.button>
                  )}
                </div>
              </div>

              <div className="bg-white/70 backdrop-blur-md rounded-[2.5rem] shadow-[0_30px_60px_rgba(0,0,0,0.05)] border border-white overflow-hidden">
                <div className="p-8 border-b border-gray-100/50 bg-white/50 backdrop-blur-xl flex justify-between items-center">
                  <div className="flex items-center space-x-3">
                    <div className="bg-blue-600 p-2 rounded-xl text-white">
                      <History className="w-5 h-5" />
                    </div>
                    <h2 className="text-2xl font-black text-gray-900 tracking-tighter">Laporan Harian</h2>
                  </div>
                  <div className="bg-gray-100 px-4 py-1.5 rounded-full text-[10px] font-black text-gray-400 uppercase tracking-widest">
                    {filteredAttendances.length} Records Found
                  </div>
                </div>

                <div className="overflow-x-auto min-h-[400px]">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-gray-50/50 text-gray-400 uppercase text-[10px] font-black tracking-[0.2em]">
                        <th className="px-8 py-5 border-b border-gray-100/50">Identitas Siswa</th>
                        <th className="px-8 py-5 border-b border-gray-100/50">Status Kelas</th>
                        <th className="px-8 py-5 border-b border-gray-100/50">Tanggal Absen</th>
                        <th className="px-8 py-5 border-b border-gray-100/50 text-right">Timestamp</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50/50">
                      {filteredAttendances.length > 0 ? (
                        filteredAttendances.map((att, idx) => (
                          <motion.tr 
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: idx * 0.02 }}
                            key={att.id} 
                            className="hover:bg-blue-50/30 transition-all group"
                          >
                            <td className="px-8 py-5">
                               <div className="flex items-center space-x-3">
                                 <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center font-black text-blue-600 text-xs">
                                   {att.nama.charAt(0)}
                                 </div>
                                 <span className="font-black text-gray-900 text-sm tracking-tight">{att.nama}</span>
                               </div>
                            </td>
                            <td className="px-8 py-5">
                              <span className="text-gray-500 font-black text-[10px] tracking-widest uppercase bg-gray-100 px-2 py-1 rounded">{att.kelas}</span>
                            </td>
                            <td className="px-8 py-5 font-bold text-xs text-gray-400">{att.tanggal}</td>
                            <td className="px-8 py-5 text-right">
                              <span className="bg-blue-600 text-white px-4 py-1.5 rounded-full text-[10px] font-black shadow-lg shadow-blue-200 border border-white/20 font-mono">
                                {att.waktu}
                              </span>
                            </td>
                          </motion.tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={4} className="px-8 py-24 text-center">
                            <div className="flex flex-col items-center text-gray-400 space-y-4 opacity-20">
                               <Search className="w-16 h-16" />
                               <p className="font-black uppercase text-xs tracking-widest">Data tidak ditemukan</p>
                             </div>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* QR Viewer Modal */}
      <AnimatePresence>
        {selectedStudent && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedStudent(null)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden"
            >
              <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                <div>
                  <h3 className="font-bold text-gray-900">{selectedStudent.nama}</h3>
                  <p className="text-xs text-gray-400 uppercase font-bold tracking-wider">{selectedStudent.kelas}</p>
                </div>
                <button 
                  onClick={() => setSelectedStudent(null)}
                  className="p-2 hover:bg-gray-200 rounded-full transition-colors"
                >
                  <X className="w-5 h-5 text-gray-400" />
                </button>
              </div>
              
              <div className="p-10 flex flex-col items-center space-y-6">
                <div className="bg-white p-4 rounded-2xl shadow-inner border border-gray-100">
                  <QRCodeCanvas 
                    id={`qr-large-${selectedStudent.id}`}
                    value={selectedStudent.qrData} 
                    size={220} 
                    level="H"
                    includeMargin={true}
                  />
                </div>
                
                <button 
                  onClick={() => handleDownloadQR(`qr-large-${selectedStudent.id}`, selectedStudent.nama)}
                  className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl font-bold transition-all shadow-lg shadow-blue-100"
                >
                  <Download className="w-4 h-4" />
                  <span>Download QR</span>
                </button>
              </div>
              
              <div className="p-4 bg-gray-50 text-center">
                <p className="text-[10px] text-gray-400 font-mono break-all px-4 tracking-tighter opacity-50">{selectedStudent.qrData}</p>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Footer */}
      <footer className="py-12 bg-white border-t border-gray-100 mt-auto">
        <div className="max-w-7xl mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-4">
           <div className="flex items-center space-x-2 text-blue-600 opacity-60">
             <QrCode className="w-5 h-5" />
             <span className="font-bold text-sm tracking-tighter uppercase">SISTEM ABSENSI QR - SMP</span>
           </div>
           <div className="text-gray-400 text-xs font-medium">
             Developed by <span className="text-gray-600 font-bold underline decoration-blue-200">Modern SMP System</span>
           </div>
           <div className="text-gray-300 text-[10px] font-mono">
             &copy; {new Date().getFullYear()} School Management System
           </div>
        </div>
      </footer>

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes scan {
          0%, 100% { top: 10%; opacity: 0.3; }
          50% { top: 90%; opacity: 1; }
        }
        #reader {
          width: 100% !important;
          border: none !important;
        }
        #reader video {
          object-fit: cover !important;
          border-radius: 12px;
        }
        #reader__scan_region {
           background: transparent !important;
        }
        #reader__dashboard {
          display: none !important;
        }
      `}} />
    </div>
  );
}
