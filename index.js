let openBottomSheet = document.getElementById("open-bottom-sheet")
const overlay = document.getElementById('overlay')

openBottomSheet.addEventListener("click", () => {
    overlay.style.display = 'flex';
})

overlay.addEventListener('click', (event) => {
    if (event.target === overlay) {
    overlay.style.display = 'none';
}})