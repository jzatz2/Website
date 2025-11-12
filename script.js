function toggleMenu() {
    const menu = document.querySelector(".menu-links");
    const icon = document.querySelector(".hamburger-icon");
    menu.classList.toggle("open");
    icon.classList.toggle("open");
}

/*
 * Expandable project tabs, résumé dropdown, and video gallery with custom controls
 */
document.addEventListener('DOMContentLoaded', () => {
    // Toggle project tabs
    const projectHeaders = document.querySelectorAll('.project-header');
    projectHeaders.forEach(header => {
        header.addEventListener('click', () => {
            const item = header.parentElement;
            const currentlyOpen = item.classList.contains('open');
            document.querySelectorAll('.project-item.open').forEach(openItem => {
                if (openItem !== item) openItem.classList.remove('open');
            });
            document.querySelectorAll('.project-item').forEach(itm => itm.classList.remove('hidden-project'));
            if (currentlyOpen) {
                item.classList.remove('open');
            } else {
                item.classList.add('open');
                const allItems = Array.from(document.querySelectorAll('.project-item'));
                const index = allItems.indexOf(item);
                allItems.forEach((itm, idx) => {
                    if (idx > index) itm.classList.add('hidden-project');
                });
            }
        });
    });

    // Initialize galleries
    const galleries = document.querySelectorAll('.project-gallery');
    
    const projectCaptions = {
        0: [
            'FermiLabs NUMI Project. Worlds most powerful neutrino beam (700kW!). Our project focuses on the Target Hall specifically, where most of the radiation is produced.',
            'The real flange + Beryillium disc used in the process. Not used for demo/simulations.',
            'Simulation setup. This is what the UFactory xArm6 sees with a simplified flange in MujoCo Physics Simulator.',
            'Completed simulation demo done on MujoCo.',
            'Real life demo presented at Senior Design Expo. Missed a bolt due to shaking of the flimsy table.',
        ],
        1: [
            'Experimental testing at 10°F across multiple samples.',
            'Detailed multiphase CFD simulation with porous effects.',
            'Surface tension analysis for electrolyte optimization.'
        ],
        2: [
            'Exoskeleton design with impedance control',
            'Biomechanical joint configuration',
            'Control system integration'
        ],
        3: [
            'Exoskeleton design with impedance control',
            'Biomechanical joint configuration',
            'Control system integration'
        ],
        4: [
            'Matlab Output of Dwell, Rest and Return configuration of CAM',
            'SolidWorks view of the Crankshaft',
            'Final Assembly of Fidget Toy.',
            'Fidget toy in action.'
        ],
        5: [
            'Rack and Pinion Assembly',
            'Final Assembly of Autonomous System',
            'Robot in action'
        ]

    };
    
    galleries.forEach((gallery, galleryIndex) => {
        const slides = gallery.querySelectorAll('.gallery-slide');
        const prevBtn = gallery.querySelector('.gallery-prev');
        const nextBtn = gallery.querySelector('.gallery-next');
        const captionEl = gallery.querySelector('.gallery-caption');
        const captions = projectCaptions[galleryIndex] || [];
        
        // Video controls
        const videoControls = gallery.querySelector('.video-controls');
        const playPauseBtn = gallery.querySelector('.play-pause-btn');
        const playIcon = gallery.querySelector('.play-icon');
        const pauseIcon = gallery.querySelector('.pause-icon');
        const progressBar = gallery.querySelector('.progress-bar');
        const progressFilled = gallery.querySelector('.progress-filled');
        const currentTimeEl = gallery.querySelector('.current-time');
        const durationEl = gallery.querySelector('.duration');
        const muteBtn = gallery.querySelector('.mute-btn');
        const mutedIcon = gallery.querySelector('.muted-icon');
        const unmutedIcon = gallery.querySelector('.unmuted-icon');
        
        let currentIndex = 0;
        let touchStartX = 0;
        let touchEndX = 0;
        let currentVideo = null;
        let controlsTimeout = null;
        
        // Function to show controls temporarily
        function showControlsTemporarily(galleryContainer) {
            if (galleryContainer) {
                galleryContainer.classList.add('show-controls');
                clearTimeout(controlsTimeout);
                controlsTimeout = setTimeout(() => {
                    galleryContainer.classList.remove('show-controls');
                }, 5000); // Increased to 5 seconds for better mobile UX
            }
        }
        
        function formatTime(seconds) {
            const mins = Math.floor(seconds / 60);
            const secs = Math.floor(seconds % 60);
            return `${mins}:${secs.toString().padStart(2, '0')}`;
        }
        
        function updateVideoControls(video) {
            if (!video || !videoControls) return;
            
            currentVideo = video;
            
            // Update progress bar
            const percent = (video.currentTime / video.duration) * 100;
            progressFilled.style.width = percent + '%';
            
            // Update time display
            currentTimeEl.textContent = formatTime(video.currentTime);
            durationEl.textContent = formatTime(video.duration || 0);
            
            // Update play/pause icon
            if (video.paused) {
                playIcon.style.display = 'inline';
                pauseIcon.style.display = 'none';
            } else {
                playIcon.style.display = 'none';
                pauseIcon.style.display = 'inline';
            }
        }
        
        function showSlide(index) {
            slides.forEach((slide, i) => {
                const activeSlide = slides[index];
                const hasVideo = !!activeSlide.querySelector('video');
                gallery.classList.toggle('has-video', hasVideo);

                const isActive = i === index;
                slide.classList.toggle('active', isActive);
                
                const video = slide.querySelector('video');
                const galleryContainer = slide.closest('.gallery-container');
                
                if (video) {
                    if (isActive) {
                        // Make sure video is visible first
                        slide.style.display = 'flex';
                        
                        // Show controls immediately for mobile
                        if (galleryContainer && window.innerWidth <= 1000) {
                            showControlsTemporarily(galleryContainer);
                        }
                        
                        // Wait a tiny bit for the slide to be visible
                        setTimeout(() => {
                            video.currentTime = 0;
                            
                            // Try to play with better error handling
                            const playPromise = video.play();
                            if (playPromise !== undefined) {
                                playPromise.then(() => {
                                    slide.classList.remove('needs-interaction');
                                    // Show controls initially when video starts playing
                                    showControlsTemporarily(galleryContainer);
                                }).catch(e => {
                                    // Show play button overlay
                                    slide.classList.add('needs-interaction');
                                    gallery.addEventListener('click', () => {
                                        video.play().then(() => {
                                            slide.classList.remove('needs-interaction');
                                        });
                                    }, { once: true });
                                });
                            }
                        }, 50);
                        
                        if (videoControls) {
                            videoControls.style.display = 'flex';
                        }
                        
                        if (videoControls) {
                            videoControls.style.display = 'flex';
                        }
                        
                        video.addEventListener('timeupdate', () => updateVideoControls(video));
                        video.addEventListener('loadedmetadata', () => {
                            updateVideoControls(video);
                            console.log(`Video ${index + 1} loaded:`, video.videoWidth, 'x', video.videoHeight);
                        });

                        // Inside the showSlide function, after the video event listeners:
                        video.addEventListener('ended', () => {
                            if (currentVideo === video) {
                                video.currentTime = 0;
                                video.play().catch(e => console.log('Loop play prevented'));
                            }
                        });
                        
                        currentVideo = video;
                        updateVideoControls(video);
                    } else {
                        video.pause();
                        video.currentTime = 0;
                        
                        // Remove show-controls class when switching slides
                        if (galleryContainer) {
                            galleryContainer.classList.remove('show-controls');
                        }
                    }
                } else {
                    if (videoControls) {
                        videoControls.style.display = 'none';
                    }
                }
            });
            
            if (captionEl && captions[index]) {
                captionEl.textContent = captions[index];
            }
        }

        
        
        function nextSlide() {
            currentIndex = (currentIndex + 1) % slides.length;
            showSlide(currentIndex);
        }
        
        function prevSlide() {
            currentIndex = (currentIndex - 1 + slides.length) % slides.length;
            showSlide(currentIndex);
        }
        
        // Play/Pause button
        if (playPauseBtn) {
            playPauseBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (currentVideo) {
                    if (currentVideo.paused) {
                        currentVideo.play();
                    } else {
                        currentVideo.pause();
                    }
                }
            });
        }
        
        // Progress bar click
        if (progressBar) {
            progressBar.addEventListener('click', (e) => {
                e.stopPropagation();
                if (currentVideo) {
                    const rect = progressBar.getBoundingClientRect();
                    const pos = (e.clientX - rect.left) / rect.width;
                    currentVideo.currentTime = pos * currentVideo.duration;
                }
            });
        }
        
        // Mute button
        if (muteBtn) {
            muteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (currentVideo) {
                    currentVideo.muted = !currentVideo.muted;
                    if (currentVideo.muted) {
                        mutedIcon.style.display = 'inline';
                        unmutedIcon.style.display = 'none';
                    } else {
                        mutedIcon.style.display = 'none';
                        unmutedIcon.style.display = 'inline';
                    }
                }
            });
        }
        // Fullscreen button
        const fullscreenBtn = gallery.querySelector('.fullscreen-btn');
        const fullscreenIcon = gallery.querySelector('.fullscreen-icon');
        const exitFullscreenIcon = gallery.querySelector('.exit-fullscreen-icon');

        if (fullscreenBtn) {
            fullscreenBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                
                if (!document.fullscreenElement) {
                    // Enter fullscreen
                    gallery.classList.add('fullscreen');
                    if (gallery.requestFullscreen) {
                        gallery.requestFullscreen();
                    } else if (gallery.webkitRequestFullscreen) {
                        gallery.webkitRequestFullscreen();
                    } else if (gallery.msRequestFullscreen) {
                        gallery.msRequestFullscreen();
                    }
                    
                    if (fullscreenIcon && exitFullscreenIcon) {
                        fullscreenIcon.style.display = 'none';
                        exitFullscreenIcon.style.display = 'inline';
                    }
                } else {
                    // Exit fullscreen
                    gallery.classList.remove('fullscreen');
                    if (document.exitFullscreen) {
                        document.exitFullscreen();
                    } else if (document.webkitExitFullscreen) {
                        document.webkitExitFullscreen();
                    } else if (document.msExitFullscreen) {
                        document.msExitFullscreen();
                    }
                    
                    if (fullscreenIcon && exitFullscreenIcon) {
                        fullscreenIcon.style.display = 'inline';
                        exitFullscreenIcon.style.display = 'none';
                    }
                }
            });
            
            // Listen for fullscreen changes
            document.addEventListener('fullscreenchange', () => {
                if (!document.fullscreenElement) {
                    gallery.classList.remove('fullscreen');
                    if (fullscreenIcon && exitFullscreenIcon) {
                        fullscreenIcon.style.display = 'inline';
                        exitFullscreenIcon.style.display = 'none';
                    }
                }
            });
        }
        
        // Arrow controls
        if (prevBtn) {
            prevBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                prevSlide();
            });
        }
        
        if (nextBtn) {
            nextBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                nextSlide();
            });
        }
        
        // Swipe support with better video handling
        let isTouchingVideo = false;
        
        gallery.addEventListener('touchstart', (e) => {
            touchStartX = e.changedTouches[0].screenX;
            // Check if we're touching a video or controls
            isTouchingVideo = !!(e.target.closest('video') || 
                               e.target.closest('.video-controls') ||
                               e.target.closest('.gallery-arrow'));
        }, { passive: true });
        
        gallery.addEventListener('touchend', (e) => {
            // Don't handle swipe if we touched a video or controls
            if (isTouchingVideo) {
                isTouchingVideo = false;
                return;
            }
            
            touchEndX = e.changedTouches[0].screenX;
            const diff = touchStartX - touchEndX;
            if (Math.abs(diff) > 50) {
                if (diff > 0) {
                    nextSlide();
                } else {
                    prevSlide();
                }
            }
        }, { passive: true });
        
        // Initialize
        if (captionEl && captions[0]) {
            captionEl.textContent = captions[0];
        }
        showSlide(0);
        
        // Set up video click handlers for all slides (do this once, not in showSlide)
        slides.forEach((slide) => {
            const video = slide.querySelector('video');
            if (video) {
                const galleryContainer = slide.closest('.gallery-container');
                
                const clickHandler = (e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    console.log('Video clicked, showing controls');
                    showControlsTemporarily(galleryContainer);
                };
                
                // For desktop clicks
                video.addEventListener('click', clickHandler);
                
                // For mobile touches - prevent swipe and show controls
                video.addEventListener('touchstart', (e) => {
                    e.stopPropagation();
                    console.log('Video touched, showing controls');
                    showControlsTemporarily(galleryContainer);
                    
                    // Prevent the touchend from triggering swipe
                    const preventSwipe = (event) => {
                        event.stopPropagation();
                        video.removeEventListener('touchend', preventSwipe);
                    };
                    video.addEventListener('touchend', preventSwipe, { once: true });
                }, { passive: false });
            }
        });
        
        // Add touch handler to gallery container for mobile
        const galleryContainer = gallery.querySelector('.gallery-container');
        if (galleryContainer) {
            galleryContainer.addEventListener('touchstart', (e) => {
                // Only trigger if touching the video area, not controls or arrows
                if (!e.target.closest('.video-controls') && 
                    !e.target.closest('.gallery-arrow') &&
                    !e.target.closest('button')) {
                    const activeSlide = slides[currentIndex];
                    if (activeSlide && activeSlide.querySelector('video')) {
                        console.log('Gallery container touched, showing controls');
                        showControlsTemporarily(galleryContainer);
                    }
                }
            }, { passive: true });
        }
        
        // Set up control button interactions
        if (videoControls) {
            videoControls.addEventListener('click', (e) => {
                e.stopPropagation();
                const galleryContainer = gallery.querySelector('.gallery-container');
                showControlsTemporarily(galleryContainer);
            });
        }
    });

    // Toggle résumé dropdown
    const resumeHeaders = document.querySelectorAll('.resume-header');
    resumeHeaders.forEach(header => {
        header.addEventListener('click', () => {
            const item = header.parentElement;
            item.classList.toggle('open');
        });
    });
});