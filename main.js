class PDFReader {
  constructor() {
    this.pdf = null;
    this.currentPage = 0;
    this.totalPages = 0;
    this.pages = [];
    this.utterance = null;
    this.isPlaying = false;
    this.currentText = "";
    this.currentFileType = null; // 'pdf' or 'word'
    this.wordContent = null; // Store Word document content
    this.currentSentenceIndex = 0; // Add this line

    this.initializeElements();
    this.setupEventListeners();
    this.loadVoices();
  }

  initializeElements() {
    this.pdfInput = document.getElementById("pdfInput");
    this.pagesContainer = document.getElementById("pagesContainer");
    this.textContent = document.getElementById("textContent");
    this.playBtn = document.getElementById("playBtn");
    this.pauseBtn = document.getElementById("pauseBtn");
    this.stopBtn = document.getElementById("stopBtn");
    this.prevBtn = document.getElementById("prevBtn");
    this.nextBtn = document.getElementById("nextBtn");
    this.pageInfo = document.getElementById("pageInfo");
    this.speedSelect = document.getElementById("speedSelect");
    this.voiceSelect = document.getElementById("voiceSelect");
    this.progressFill = document.getElementById("progressFill");
    this.sidebarToggle = document.getElementById("sidebarToggle");
    this.sidebar = document.getElementById("sidebar");
    this.editBtn = document.getElementById("editBtn");
    this.saveBtn = document.getElementById("saveBtn");
    this.cancelBtn = document.getElementById("cancelBtn");
  }

  setupEventListeners() {
    this.pdfInput.addEventListener("change", (e) => this.loadPDF(e));
    this.playBtn.addEventListener("click", () => this.play());
    this.pauseBtn.addEventListener("click", () => this.pause());
    this.stopBtn.addEventListener("click", () => this.stop());
    this.prevBtn.addEventListener("click", () => this.previousPage());
    this.nextBtn.addEventListener("click", () => this.nextPage());
    this.sidebarToggle.addEventListener("click", () => this.toggleSidebar());
    this.editBtn.addEventListener("click", () => this.enableEdit());
    this.saveBtn.addEventListener("click", () => this.saveEdit());
    this.cancelBtn.addEventListener("click", () => this.cancelEdit());

    // Keyboard shortcuts
    document.addEventListener("keydown", (e) => {
      if (e.code === "Space" && e.target.tagName !== "TEXTAREA") {
        e.preventDefault();
        this.togglePlayPause();
      }
    });
  }

  async loadPDF(event) {
    const file = event.target.files[0];
    if (!file) return;

    const fileType = this.getFileType(file);
    this.currentFileType = fileType;

    try {
      if (fileType === "pdf") {
        await this.loadPDFDocument(file);
      } else if (fileType === "word") {
        await this.loadWordDocument(file);
      } else if (fileType === "txt") {
        await this.loadTxtDocument(file); // Novo método para TXT
      }

      this.updatePageInfo();
    } catch (error) {
      console.error("Error loading file:", error);
      this.textContent.innerHTML =
        '<div style="text-align: center; margin-top: 100px; color: var(--gray);">Erro ao carregar arquivo</div>';
    }
  }

  getFileType(file) {
    const extension = file.name.split(".").pop().toLowerCase();
    if (extension === "pdf") return "pdf";
    if (extension === "docx") return "word";
    if (extension === "txt") return "txt"; // Adicionado suporte a TXT
    return null;
  }

  async loadPDFDocument(file) {
    const arrayBuffer = await file.arrayBuffer();
    this.pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    this.totalPages = this.pdf.numPages;
    this.pages = [];

    // Load all pages
    for (let i = 1; i <= this.totalPages; i++) {
      const page = await this.pdf.getPage(i);
      const textContent = await page.getTextContent();
      const text = textContent.items.map((item) => item.str).join(" ");
      this.pages.push({ number: i, text, type: "pdf" });
    }

    this.currentPage = 1;
    this.displayPage(1);
    this.renderPagesList();
  }

  async loadWordDocument(file) {
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer });

    this.wordContent = result.value;
    this.pages = [];

    // Split Word content into pages using form feed characters and page breaks
    // First, let's try to preserve some structure by splitting on double line breaks
    const paragraphs = this.wordContent.split(/\n\n+/);

    // Group paragraphs into pages (approximate 10-15 paragraphs per page)
    const paragraphsPerPage = 12;
    const totalPages = Math.ceil(paragraphs.length / paragraphsPerPage);

    for (let i = 0; i < totalPages; i++) {
      const startIndex = i * paragraphsPerPage;
      const endIndex = Math.min(
        startIndex + paragraphsPerPage,
        paragraphs.length
      );
      const pageParagraphs = paragraphs.slice(startIndex, endIndex);
      const pageText = pageParagraphs.join("\n\n");

      this.pages.push({
        number: i + 1,
        text: pageText,
        type: "word",
        preview: pageParagraphs.slice(0, 2).join(" ").substring(0, 100),
      });
    }

    this.totalPages = totalPages;
    this.currentPage = 1;
    this.displayPage(1);
    this.renderPagesList();
  }

  // Novo método para TXT
  async loadTxtDocument(file) {
    const text = await file.text();
    this.pages = [];

    // Divide o texto em páginas de ~1500 caracteres (ajuste conforme necessário)
    const charsPerPage = 1500;
    const totalPages = Math.ceil(text.length / charsPerPage);

    for (let i = 0; i < totalPages; i++) {
      const start = i * charsPerPage;
      const end = Math.min(start + charsPerPage, text.length);
      const pageText = text.substring(start, end);

      this.pages.push({
        number: i + 1,
        text: pageText,
        type: "txt",
        preview: pageText.substring(0, 100),
      });
    }

    this.totalPages = totalPages;
    this.currentPage = 1;
    this.displayPage(1);
    this.renderPagesList();
  }

  renderPagesList() {
    this.pagesContainer.innerHTML = "";

    this.pages.forEach((page) => {
      const pageElement = document.createElement("div");
      pageElement.className = "page-item";

      // Use stored preview if available, otherwise generate from text
      const previewText = page.preview || page.text.substring(0, 100);

      pageElement.innerHTML = `
      <div class="page-number">
        Página ${page.number}
        <span class="file-type-indicator ${
          page.type
        }">${page.type.toUpperCase()}</span>
      </div>
      <div class="page-preview">${previewText}...</div>
    `;

      pageElement.addEventListener("click", () =>
        this.displayPage(page.number)
      );
      this.pagesContainer.appendChild(pageElement);
    });
  }

  displayPage(pageNumber) {
    if (pageNumber < 1 || pageNumber > this.totalPages) return;

    this.currentPage = pageNumber;
    const page = this.pages[pageNumber - 1];
    this.currentText = page.text;

    // Format text with proper paragraphs
    const formattedText = this.currentText
      .split("\n\n")
      .map((paragraph) => `<p style="margin-bottom: 16px;">${paragraph}</p>`)
      .join("");

    this.textContent.innerHTML = formattedText;
    this.textContent.contentEditable = false;
    this.updatePageInfo();
    this.updateActivePage();
  }

  updateActivePage() {
    document.querySelectorAll(".page-item").forEach((item, index) => {
      item.classList.toggle("active", index + 1 === this.currentPage);
    });
  }

  updatePageInfo() {
    this.pageInfo.textContent = `Página ${this.currentPage} de ${this.totalPages}`;
  }

  previousPage() {
    if (this.currentPage > 1) {
      this.displayPage(this.currentPage - 1);
    }
  }

  nextPage() {
    if (this.currentPage < this.totalPages) {
      this.displayPage(this.currentPage + 1);
    }
  }

  toggleSidebar() {
    this.sidebar.classList.toggle("collapsed");
  }

  loadVoices() {
    const loadVoices = () => {
      const voices = speechSynthesis.getVoices();
      this.voiceSelect.innerHTML = "";

      const portugueseVoices = voices.filter(
        (voice) => voice.lang.startsWith("pt") || voice.lang.startsWith("pt-BR")
      );

      if (portugueseVoices.length === 0) {
        // Fallback to any available voices
        voices.forEach((voice) => {
          const option = document.createElement("option");
          option.value = voice.name;
          option.textContent = `${voice.name} (${voice.lang})`;
          this.voiceSelect.appendChild(option);
        });
      } else {
        portugueseVoices.forEach((voice) => {
          const option = document.createElement("option");
          option.value = voice.name;
          option.textContent = `${voice.name} (${voice.lang})`;
          this.voiceSelect.appendChild(option);
        });
      }
    };

    speechSynthesis.onvoiceschanged = loadVoices;
    loadVoices();
  }

  play() {
    if (!this.currentText) return;

    this.stop();

    this.utterance = new SpeechSynthesisUtterance(this.currentText);
    this.utterance.lang = "pt-BR";
    this.utterance.rate = parseFloat(this.speedSelect.value);

    const selectedVoice = this.voiceSelect.value;
    if (selectedVoice) {
      const voices = speechSynthesis.getVoices();
      const voice = voices.find((v) => v.name === selectedVoice);
      if (voice) this.utterance.voice = voice;
    }

    this.utterance.onstart = () => {
      this.isPlaying = true;
      this.playBtn.classList.add("active");
    };

    this.utterance.onend = () => {
      this.isPlaying = false;
      this.playBtn.classList.remove("active");
      this.progressFill.style.width = "0%";

      // Auto-advance to next page when finished reading current page
      if (this.currentPage < this.totalPages) {
        this.nextPage();
        this.play();
      }
    };

    this.utterance.onerror = () => {
      this.isPlaying = false;
      this.playBtn.classList.remove("active");
    };

    // Highlight text as it speaks - now by sentence
    const sentences = this.splitIntoSentences(this.currentText);
    const sentenceElements = [];

    this.textContent.innerHTML = "";
    sentences.forEach((sentence, index) => {
      const span = document.createElement("span");
      span.textContent = sentence + " ";
      span.id = `sentence-${index}`;
      this.textContent.appendChild(span);
      sentenceElements.push(span);
    });

    this.utterance.onboundary = (event) => {
      if (event.name === "word") {
        const progress = (event.charIndex / this.currentText.length) * 100;
        this.progressFill.style.width = progress + "%";

        // Find which sentence we're currently in
        let currentCharIndex = event.charIndex;
        let accumulatedLength = 0;

        for (let i = 0; i < sentences.length; i++) {
          const sentenceLength = sentences[i].length + 1; // +1 for space
          if (
            currentCharIndex >= accumulatedLength &&
            currentCharIndex < accumulatedLength + sentenceLength
          ) {
            if (i !== this.currentSentenceIndex) {
              // Remove previous highlight
              if (this.currentSentenceIndex < sentenceElements.length) {
                sentenceElements[this.currentSentenceIndex].classList.remove(
                  "highlight"
                );
              }
              // Add new highlight
              this.currentSentenceIndex = i;
              if (this.currentSentenceIndex < sentenceElements.length) {
                sentenceElements[this.currentSentenceIndex].classList.add(
                  "highlight"
                );
              }
            }
            break;
          }
          accumulatedLength += sentenceLength;
        }
      }
    };

    speechSynthesis.speak(this.utterance);
  }

  pause() {
    if (speechSynthesis.speaking && !speechSynthesis.paused) {
      speechSynthesis.pause();
      this.playBtn.classList.remove("active");
    }
  }

  stop() {
    speechSynthesis.cancel();
    this.isPlaying = false;
    this.playBtn.classList.remove("active");
    this.progressFill.style.width = "0%";

    // Remove highlights
    document.querySelectorAll(".highlight").forEach((el) => {
      el.classList.remove("highlight");
    });

    // Reset sentence index
    this.currentSentenceIndex = 0;
  }

  togglePlayPause() {
    if (this.isPlaying) {
      this.pause();
    } else {
      this.play();
    }
  }

  enableEdit() {
    if (!this.currentText) return;

    this.stop();
    this.textContent.contentEditable = true;
    this.textContent.focus();

    // Show/hide buttons
    this.editBtn.style.display = "none";
    this.saveBtn.style.display = "flex";
    this.cancelBtn.style.display = "flex";
  }

  saveEdit() {
    // Get the edited text
    const editedText = this.textContent.innerText;

    // Update current text and page data
    this.currentText = editedText;
    this.pages[this.currentPage - 1].text = editedText;

    // Exit edit mode
    this.textContent.contentEditable = false;

    // Show/hide buttons
    this.editBtn.style.display = "flex";
    this.saveBtn.style.display = "none";
    this.cancelBtn.style.display = "none";
  }

  cancelEdit() {
    // Revert to original text
    this.displayPage(this.currentPage);

    // Show/hide buttons
    this.editBtn.style.display = "flex";
    this.saveBtn.style.display = "none";
    this.cancelBtn.style.display = "none";
  }

  splitIntoSentences(text) {
    // Split text into sentences based on punctuation
    // This regex splits on . ! ? but keeps the punctuation
    return text.match(/[^.!?]+[.!?]+/g) || [text];
  }
}

// Initialize the app
const reader = new PDFReader();
