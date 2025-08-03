const ffmpeg = require('fluent-ffmpeg');
const path = require('path');
const fs = require('fs');
const util = require('util');
const { v4: uuidv4 } = require('uuid');

const unlinkAsync = util.promisify(fs.unlink);

const processReel = async (req, res, next) => {
  if (!req.file) return next();
  
  try {
    const tempDir = path.join(__dirname, '../temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir);
    }

    const tempInputPath = path.join(tempDir, `${uuidv4()}${path.extname(req.file.originalname)}`);
    const tempOutputPath = path.join(tempDir, `${uuidv4()}.mp4`);
    const tempThumbnailPath = path.join(tempDir, `${uuidv4()}.jpg`);

    // Write the uploaded file to temp storage
    await fs.promises.writeFile(tempInputPath, req.file.buffer);

    // Process video based on frontend editing parameters
    const processingOptions = {
      trimStart: req.body.trimStart,
      trimEnd: req.body.trimEnd,
      playbackRate: req.body.playbackRate || 1,
      isReversed: req.body.isReversed === 'true',
      effects: req.body.effects ? JSON.parse(req.body.effects) : {},
      audioVolume: req.body.audioVolume || 100
    };

    await new Promise((resolve, reject) => {
      let command = ffmpeg(tempInputPath);

      // Trim video
      if (processingOptions.trimStart || processingOptions.trimEnd) {
        const start = processingOptions.trimStart || 0;
        const end = processingOptions.trimEnd || undefined;
        command = command.setStartTime(start);
        if (end) {
          command = command.setDuration(end - start);
        }
      }

      // Playback speed
      if (processingOptions.playbackRate !== 1) {
        command = command.videoFilters(`setpts=${1/processingOptions.playbackRate}*PTS`);
        command = command.audioFilters(`atempo=${processingOptions.playbackRate}`);
      }

      // Reverse video
      if (processingOptions.isReversed) {
        command = command.videoFilters('reverse').audioFilters('areverse');
      }

      // Audio volume
      command = command.audioFilter(`volume=${processingOptions.audioVolume / 100}`);

      // Video effects
      if (processingOptions.effects) {
        const filters = [];
        if (processingOptions.effects.brightness) {
          filters.push(`eq=brightness=${(processingOptions.effects.brightness - 100) / 100}`);
        }
        if (processingOptions.effects.contrast) {
          filters.push(`eq=contrast=${processingOptions.effects.contrast / 100}`);
        }
        if (processingOptions.effects.saturation) {
          filters.push(`eq=saturation=${processingOptions.effects.saturation / 100}`);
        }
        if (processingOptions.effects.blur) {
          filters.push(`boxblur=${processingOptions.effects.blur}`);
        }
        if (filters.length > 0) {
          command = command.videoFilters(filters.join(','));
        }
      }

      command
        .output(tempOutputPath)
        .on('end', async () => {
          // Generate thumbnail
          await new Promise((thumbResolve, thumbReject) => {
            ffmpeg(tempOutputPath)
              .screenshots({
                timestamps: ['50%'],
                filename: path.basename(tempThumbnailPath),
                folder: tempDir,
                size: '640x360'
              })
              .on('end', thumbResolve)
              .on('error', thumbReject);
          });

          // Read processed files
          const processedVideo = await fs.promises.readFile(tempOutputPath);
          const thumbnail = await fs.promises.readFile(tempThumbnailPath);

          // Attach to request
          req.processedFiles = {
            video: {
              buffer: processedVideo,
              originalname: `processed_${req.file.originalname}`
            },
            thumbnail: {
              buffer: thumbnail,
              originalname: `thumbnail_${path.basename(req.file.originalname, path.extname(req.file.originalname))}.jpg`
            }
          };

          // Clean up temp files
          await Promise.all([
            unlinkAsync(tempInputPath),
            unlinkAsync(tempOutputPath),
            unlinkAsync(tempThumbnailPath)
          ]);

          resolve();
        })
        .on('error', reject)
        .run();
    });

    next();
  } catch (err) {
    next(err);
  }
};

module.exports = processReel;