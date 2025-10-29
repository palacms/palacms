import StarterKit from '@tiptap/starter-kit'
import Typography from '@tiptap/extension-typography'
import Image from '@tiptap/extension-image'
import Youtube from '@tiptap/extension-youtube'
import Highlight from '@tiptap/extension-highlight'

export const rich_text_extensions = [
	StarterKit.configure({
		link: {
			openOnClick: false
		}
	}),
	Image,
	Youtube.configure({
		modestBranding: true
	}),
	Typography,
	Highlight.configure({ multicolor: false })
]
